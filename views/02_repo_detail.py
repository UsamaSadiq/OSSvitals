from __future__ import annotations

from urllib.parse import urlencode

import pandas as pd
import streamlit as st
from rapidfuzz import fuzz

from dashboard.lib.checks import category_columns, category_stats, classify
from dashboard.lib.config import get_config, get_feature_flags
from dashboard.data import load_maintenance, load_scored_history, load_scored_snapshot
from dashboard.lib import catalog
from dashboard.lib.activity import repo_signals, snapshot_has_signals, unmeasured_columns
from dashboard.lib.linking import github_issue_url, github_pr_compare_url, pr_template
from dashboard.lib.remediation import get_remediation, issue_body
from dashboard.lib.repo_detail import (
    category_card,
    metric_summary,
    owner_key_for_link,
    relation_lines,
    subscores,
)
from dashboard.lib.schema import humanize_check
from dashboard.lib.share import base_url, share_link
from dashboard.ui import empty_state, page_init, grade_pill, share_link_block, status_chip
from dashboard.ui.charts import metric_score_bar, sparkline


def _fuzzy_repo_options(repos: list[str], query: str) -> list[str]:
    if not query:
        return repos
    ranked = sorted(repos, key=lambda name: fuzz.partial_ratio(query.lower(), name.lower()), reverse=True)
    return ranked[:30]


def _history_for_repo(repo: str) -> list[dict]:
    """Per-snapshot rows for one repository.

    Deliberately not cached per repo: the underlying history is already cached by
    load_scored_history, and a per-repo layer meant browsing 20 repositories held
    20 slices of the same 30-day window (backlog H6). Filtering a cached frame is
    cheap; storing it 20 times is not.
    """
    try:
        history = load_scored_history(days=30)
    except Exception:  # noqa: BLE001 - absent history is normal
        return []
    out = []
    for snapshot in history:
        frame = snapshot.df
        if "repo_name" not in frame.columns:
            continue
        subset = frame[frame["repo_name"] == repo]
        if subset.empty:
            continue
        out.append({"date": snapshot.timestamp, "row": subset.iloc[0]})
    return out


def _repo_sparkline(repo: str, cols: list[str]) -> pd.DataFrame:
    points = []
    for entry in _history_for_repo(repo):
        pass_count, fail_count, _ = category_stats(entry["row"], cols)
        total = pass_count + fail_count
        if total == 0:
            continue
        points.append({"date": entry["date"], "pass_rate": round((pass_count / total) * 100, 2)})
    return pd.DataFrame(points)


def _category_card(category: str, repo: str, row: pd.Series, cols: list[str], *, key_prefix: str) -> dict[str, int]:
    card = category_card(row, cols)
    pass_count, fail_count, na_count = card["pass"], card["fail"], card["na"]
    with st.container(border=True):
        head_left, head_right = st.columns([3, 2])
        with head_left:
            st.markdown(f"**{category}**")
        with head_right:
            chip = (
                status_chip(card["level"], f"{card['pass_rate']:.0f}% pass")
                if card["pass_rate"] is not None
                else status_chip("unknown", "no data")
            )
            st.markdown(f"<div style='text-align:right'>{chip}</div>", unsafe_allow_html=True)
        st.caption(f"Pass {pass_count} · Fail {fail_count} · N/A {na_count}")
        spark = _repo_sparkline(repo, cols)
        if not spark.empty and len(spark) >= 2:
            st.plotly_chart(sparkline(spark), width="stretch", key=f"spark-{key_prefix}-{category}")
    return {"pass": pass_count, "fail": fail_count, "na": na_count}


def _render_check_expander(check: str, repo_row: pd.Series, selected_repo: str, *, descriptions: dict, pr_cfg: dict, feature_flags: dict, whitelisted: set[str]) -> None:
    value = repo_row.get(check)
    bucket = classify(value)
    label_chip = status_chip(bucket, bucket.upper())
    short_desc = descriptions.get(check, {}).get("description", "No description available.")
    # Status and a readable title in the *collapsed* header: previously every row
    # showed only the raw column name, so learning a check's state meant opening
    # it. A styled chip cannot go here (expander labels take limited markdown), so
    # the state is a text marker, which also keeps colour from being the only signal.
    marker = {"pass": "PASS", "fail": "FAIL"}.get(bucket, "—")
    header_label = f"`{marker}`  {humanize_check(check, descriptions)}"

    with st.expander(header_label, expanded=False):
        st.markdown(label_chip, unsafe_allow_html=True)
        st.caption(f"`{check}` · {short_desc}")
        # A Python repr ("value = 'False'") leaked the implementation. Show the
        # value plainly, and say so when absent rather than printing None/nan.
        rendered = str(value).strip()
        st.markdown(
            f"**Value:** `{rendered}`"
            if rendered and rendered.lower() != "nan"
            else "**Value:** _not recorded_"
        )

        remediation = get_remediation(check)
        if bucket == "fail" and remediation:
            st.markdown("**Remediation**")
            st.write(remediation.description)
            if remediation.snippet:
                st.code(remediation.snippet, language="yaml")
            if remediation.source_url:
                st.markdown(f"[Source]({remediation.source_url})")

            issue_url = github_issue_url(selected_repo, check, issue_body(remediation, base_url().rstrip("/")))
            action_left, action_right = st.columns(2)
            action_left.link_button("File issue on this repo", issue_url)

            if feature_flags.get("enable_pr_template_generator", True) and check in whitelisted:
                template = pr_template(check, pr_cfg)
                pr_url = github_pr_compare_url(selected_repo, template["branch"], template["title"], template["body"])
                action_right.link_button("Open PR with fix", pr_url)


def _render_activity(repo_row: pd.Series, snapshot: pd.DataFrame) -> None:
    st.header("Activity")
    if not snapshot_has_signals(list(snapshot.columns)):
        empty_state(
            "info",
            "Issue, PR backlog, CI and newcomer signals are not in this snapshot yet.",
            "They appear once the upstream repo-health run starts reporting them.",
        )
        return
    unmeasured = unmeasured_columns(snapshot)
    grouped = repo_signals(repo_row, skip=unmeasured)
    if not grouped:
        empty_state("info", "This repository reports no issue, PR or CI signals in this snapshot.")
        return
    for column, (group, signals) in zip(st.columns(len(grouped)), grouped.items()):
        with column:
            st.subheader(group)
            st.markdown("\n".join(f"- {label}: **{value}**" for label, value in signals))
    note = "Counts and medians only; newcomers are PR authors with no earlier commit in the repo."
    if unmeasured:
        note += " Newcomer counts are hidden: this snapshot reports none for any repository, which is a collection gap."
    st.caption(note)


OEP_55_URL = "https://open-edx-proposals.readthedocs.io/en/latest/processes/oep-0055-proc-project-maintainers.html"
SEVERITY_CHIP = {"problem": "fail", "note": "warn"}


def _owner_markdown(entry: dict) -> str:
    owner = entry.get("owner") or "not set"
    key = owner_key_for_link(entry)
    if key is None:
        return f"`{owner}`"
    return f"[`{owner}`](ownership_views?{urlencode({'owner': key})})"


def _catalog_facts(entry: dict) -> list[str]:
    interest = ", ".join(entry.get("arch_interest_groups") or []) or "none listed"
    return [
        f"- Owner: {_owner_markdown(entry)}",
        f"- Type: **{entry.get('type') or 'not set'}**",
        f"- Lifecycle: **{entry.get('lifecycle') or 'not set'}**",
        f"- In a named release: **{entry.get('release') or 'no'}**",
        f"- Architecture interest: {interest}",
    ]


def _catalog_relations(entry: dict) -> list[str]:
    return [f"- {line['label']}: `{line['target']}`{line['suffix']}" for line in relation_lines(entry)]


def _render_catalog(selected: str) -> None:
    st.header("Catalog")
    payload = load_maintenance(catalog.CATALOG_FILE)
    entry = catalog.record_for(payload, selected)
    if payload is None or entry is None:
        empty_state(
            "info",
            "No catalog snapshot for this repository yet.",
            "It is published daily by the collect-maintenance workflow.",
        )
        return
    if not entry.get("has_file"):
        empty_state(
            "warn",
            "This repository has no catalog-info.yaml.",
            "Backstage does not list it and its owner is unknown. OEP-55 describes the file.",
            action_label="OEP-55",
            action_url=OEP_55_URL,
        )
        return
    if not entry.get("has_entity"):
        empty_state("warn", "catalog-info.yaml is empty or not valid YAML.")
        return
    facts, about = st.columns(2)
    facts.markdown("\n".join(_catalog_facts(entry)))
    with about:
        if entry.get("description"):
            st.markdown(entry["description"])
        links = [f"- [{link['title']}]({link['url']})" for link in entry.get("links") or []]
        st.markdown("\n".join(links + _catalog_relations(entry)))
        if entry.get("backstage_url"):
            st.markdown(f"[Open in Backstage]({entry['backstage_url']})")
    labels = catalog.finding_labels(entry, catalog.legend(payload))
    if labels:
        st.markdown(
            " ".join(status_chip(SEVERITY_CHIP.get(severity, "warn"), label) for severity, label in labels),
            unsafe_allow_html=True,
        )
    st.caption(
        f"From catalog-info.yaml on the default branch, collected {str(payload['metadata'].get('generated_at', ''))[:10]}. "
        "User owners are checked against GitHub; group owners are not, since that needs openedx org membership."
    )


def render() -> None:
    page_init()
    st.title("Repository Detail")

    feature_flags = get_feature_flags()
    df = load_scored_snapshot()
    if df.empty:
        empty_state(
            "error",
            "No snapshot available.",
            "The upstream CSV and the local cache are both empty.",
        )
        return

    repos = sorted(df["repo_name"].dropna().astype(str).tolist())
    query_repo = str(st.query_params.get("repo", ""))

    # ----------------------------------------------------------------- header
    search = st.text_input("Find repository", value=query_repo or "", key="detail_search", placeholder="fuzzy match…")
    options = _fuzzy_repo_options(repos, search)
    selected = st.selectbox("Repository", options=options, index=0 if options else None, key="detail_selected")

    if not selected:
        empty_state(
            "info",
            "Pick a repository to see its detail.",
            "Type part of a name above, or arrive here from a link on Overview.",
        )
        return

    repo_row = df[df["repo_name"] == selected].iloc[0]

    # --------------------------------------------------------- repo summary
    summary = metric_summary(repo_row)

    st.markdown(
        f"## {selected} &nbsp; {grade_pill(str(repo_row.get('score_letter', '')))} &nbsp; "
        + status_chip(
            summary["level"],
            f"{summary['available']}/{summary['total']} metrics ({summary['coverage_pct']:.0f}% weight)",
        ),
        unsafe_allow_html=True,
    )
    parts = subscores(repo_row)

    def _subscore_text(category: str) -> str:
        value = parts[category]["value"]
        return "—" if value is None else f"{value:.1f}"

    sum_a, sum_b, sum_c, sum_d = st.columns(4)
    sum_a.metric("Composite", f"{repo_row['score_composite']:.1f}")
    sum_b.metric("Grade", repo_row["score_letter"])
    sum_c.metric("Structural", _subscore_text("structural"), help=parts["structural"]["help"])
    sum_d.metric("Activity", _subscore_text("activity"), help=parts["activity"]["help"])

    share_link_block(
        share_link({"tab": "detail", "repo": selected}),
        label="Copy link to this view",
    )

    # ------------------------------------------------------- single-repo view
    st.plotly_chart(
        metric_score_bar(repo_row), width="stretch", key=f"metrics-{selected}",
        config={"displayModeBar": False},
    )
    st.caption(
        f"Scoring config {repo_row.get('score_config_version', 'unknown')} · "
        "bars show each metric's contribution; unmeasured metrics are marked."
    )

    _render_activity(repo_row, df)
    _render_catalog(selected)

    # ----------------------------------------------------- category cards
    st.header("Category overview")
    categories = category_columns(df.columns)
    grid_cols = st.columns(min(3, max(1, len(categories))))
    for idx, (category, cols) in enumerate(categories.items()):
        if not cols:
            continue
        with grid_cols[idx % len(grid_cols)]:
            _category_card(category, selected, repo_row, cols, key_prefix=selected)

    # ----------------------------------------------------- check drilldown
    check_cols = [c for cols in categories.values() for c in cols]
    if not check_cols:
        return

    st.header("Checks")
    control_left, control_right = st.columns([3, 2])
    with control_left:
        filter_choice = st.radio(
            "Filter",
            options=["Failing", "Passing", "Unknown", "All"],
            horizontal=True,
            index=0,
            key="detail_filter",
        )
    with control_right:
        category_choice = st.selectbox(
            "Category",
            options=["All"] + [c for c, cols in categories.items() if cols],
            index=0,
            key="detail_category",
        )

    descriptions = get_config("check_descriptions").get("checks", {})
    pr_cfg = get_config("pr_templates")
    whitelisted = set(pr_cfg.get("whitelist", []))

    bucket_for_choice = {"Failing": "fail", "Passing": "pass", "Unknown": "unknown"}.get(filter_choice)
    visible_checks = []
    for check in sorted(check_cols):
        if category_choice != "All":
            if check not in categories[category_choice]:
                continue
        if bucket_for_choice and classify(repo_row.get(check)) != bucket_for_choice:
            continue
        visible_checks.append(check)

    st.caption(f"{len(visible_checks)} of {len(check_cols)} checks shown.")
    if not visible_checks:
        empty_state(
            "info",
            "No checks match this filter.",
            "Switch the filter to All, or pick a different category.",
        )
        return

    for check in visible_checks:
        _render_check_expander(
            check,
            repo_row,
            selected,
            descriptions=descriptions,
            pr_cfg=pr_cfg,
            feature_flags=feature_flags,
            whitelisted=whitelisted,
        )


render()

from __future__ import annotations

import re

import pandas as pd
import streamlit as st

from dashboard.data import load_config, load_history, load_snapshot
from dashboard.lib.checks import coverage, is_check_column
from dashboard.lib.check_review import SATURATED, SATURATION_SHARE, SPARSE, SPARSE_FILL, review_window, up_for_review
from dashboard.lib.remediation import missing_remediation_checks
from dashboard.lib.schema import humanize_check
from dashboard.ui import empty_state, page_init, repo_table

def _score_map() -> dict[str, dict]:
    """Map each scoring column to its metric name, weight and weight-share."""
    metrics = load_config("scoring").get("metrics", {})
    total_weight = sum(float(cfg.get("weight", 0)) for cfg in metrics.values()) or 1.0
    mapping: dict[str, dict] = {}
    for metric_name, cfg in metrics.items():
        column = cfg.get("column")
        if not column:
            continue
        weight = float(cfg.get("weight", 0))
        mapping[column] = {
            "metric": metric_name,
            "weight": weight,
            "weight_pct": round(weight / total_weight * 100, 1),
            "status": cfg.get("status", "unavailable"),
        }
    return mapping


def _render_check(check: str, *, descriptions: dict, score_map: dict, df: pd.DataFrame,
                  missing_desc: set, missing_remediation: set) -> None:
    info = descriptions.get(check, {})
    # humanize_check tidies the raw column when no title is configured, which is
    # the case for 63 of 76 checks. Previously the fallback was the column name
    # itself, so the header read "exists..coveragerc · exists..coveragerc".
    title = humanize_check(check, descriptions)
    header = f"**{title}**" if title == check else f"**{title}**  ·  `{check}`"
    with st.expander(header):
        st.write(info.get("description", "_No description entry yet._"))

        score = score_map.get(check)
        if score:
            flag = "✓ computable" if score["status"] == "computable" else "○ not yet collected"
            st.markdown(
                f"**Feeds score:** `{score['metric']}` — weight {score['weight_pct']}% ({flag})"
            )
        else:
            st.caption("Not part of the composite score (informational check).")

        meta_parts = []
        if info.get("chaoss_metric"):
            meta_parts.append(f"CHAOSS: {info['chaoss_metric']}")
        if info.get("scorecard_check"):
            meta_parts.append(f"Scorecard: {info['scorecard_check']}")
        if info.get("source_url"):
            meta_parts.append(f"[Source]({info['source_url']})")
        if meta_parts:
            st.caption(" · ".join(meta_parts))

        if check in df.columns:
            populated_pct, pass_pct = coverage(df[check])
            cols = st.columns(2)
            cols[0].metric("Org coverage (populated)", f"{populated_pct}%")
            cols[1].metric("Pass rate", f"{pass_pct}%" if pass_pct is not None else "—")

        gaps = []
        if check in missing_desc:
            gaps.append("missing description")
        if check in missing_remediation:
            gaps.append("no remediation entry")
        if gaps:
            st.caption(":warning: Config gaps: " + ", ".join(gaps))


SATURATED_COLUMNS = {
    "check": st.column_config.TextColumn("Check"),
    "dominant": st.column_config.TextColumn("Value almost every repo has"),
    "share_pct": st.column_config.NumberColumn("Share", format="%.1f%%"),
    "outliers": st.column_config.NumberColumn("Repos with another value"),
}

SPARSE_COLUMNS = {
    "check": st.column_config.TextColumn("Check"),
    "fill_pct": st.column_config.NumberColumn("Repos reporting it", format="%.1f%%"),
}


def _window_text() -> tuple[str, list]:
    history = load_history()
    window = review_window(history)
    if window.snapshots < 2:
        return "the latest snapshot only (no history retained yet)", history
    span = f"{window.first:%Y-%m-%d} to {window.last:%Y-%m-%d}"
    return f"all {window.snapshots} retained snapshots, {span}", history


def _render_up_for_review(check_columns: list[str]) -> None:
    window_text, history = _window_text()
    flagged = up_for_review(history, check_columns)
    st.header("Up for review")
    st.markdown(
        f"Checks that no longer tell repositories apart, in {window_text}. **Saturated**: one "
        f"value holds at least {SATURATION_SHARE:.0%} of the repos that report it. **Sparse**: "
        f"fewer than {SPARSE_FILL:.0%} of repos report it at all. These are raised with the "
        "Maintenance Working Group, which decides whether to retire a check, keep it to catch "
        "regressions, or fix its detection."
    )
    if flagged.empty:
        empty_state("good", "No check is saturated or sparse across the retained history.")
        return
    saturated = flagged[flagged["kind"] == SATURATED]
    sparse = flagged[flagged["kind"] == SPARSE]
    if not saturated.empty:
        st.subheader(f"Saturated ({len(saturated)})")
        repo_table(saturated, columns=list(SATURATED_COLUMNS), extra_config=SATURATED_COLUMNS)
    if not sparse.empty:
        st.subheader(f"Sparse ({len(sparse)})")
        repo_table(sparse, columns=list(SPARSE_COLUMNS), extra_config=SPARSE_COLUMNS)


def _render_candidates() -> None:
    candidates = load_config("check_candidates").get("candidates", [])
    if not candidates:
        return
    st.header("Suggested candidate checks")
    st.caption(
        "Proposed additions to the health suite, informed by current community "
        "standards (CHAOSS, OpenSSF Scorecard). Not yet implemented."
    )
    proposed = [c for c in candidates if c.get("status") == "proposed"]
    phase2 = [c for c in candidates if c.get("status") == "phase-2"]

    if proposed:
        st.subheader("Near-term (local-file checks, zero API)")
        for c in proposed:
            with st.expander(f"**{c['name']}**"):
                st.write(c.get("rationale", ""))
                if c.get("feasibility"):
                    st.caption(f"How: {c['feasibility']}")
                meta = [f"CHAOSS: {c['chaoss_metric']}"] if c.get("chaoss_metric") else []
                if c.get("scorecard_check"):
                    meta.append(f"Scorecard: {c['scorecard_check']}")
                if meta:
                    st.caption(" · ".join(meta))

    if phase2:
        st.subheader("Phase 2 (need GitHub API / admin scope)")
        for c in phase2:
            with st.expander(f"**{c['name']}**"):
                st.write(c.get("rationale", ""))
                if c.get("feasibility"):
                    st.caption(f"How: {c['feasibility']}")


def render() -> None:
    page_init()
    st.title("Checks Catalog")
    st.caption(
        "Every health check currently collected, what it measures, whether it "
        "feeds the composite score, and how the org is doing on it."
    )

    descriptions = load_config("check_descriptions").get("checks", {})
    groups = load_config("check_groups").get("groups", [])
    score_map = _score_map()
    df = load_snapshot()
    check_columns = sorted([col for col in df.columns if is_check_column(col)]) if not df.empty else []

    if not check_columns:
        empty_state(
            "warn",
            "No check columns detected in this snapshot.",
            "The catalogue below still lists proposed checks.",
        )
        _render_candidates()
        return

    missing_desc = {c for c in check_columns if c not in descriptions}
    missing_remediation = set(missing_remediation_checks(check_columns))
    scored = [c for c in check_columns if c in score_map]

    c1, c2, c3 = st.columns(3)
    c1.metric("Checks collected", len(check_columns))
    c2.metric("Feeding the score", len(scored))
    c3.metric("Missing descriptions", len(missing_desc))

    grouped_seen: set[str] = set()
    for group in groups:
        group_name = group.get("name", "Ungrouped")
        explicit = set(group.get("explicit", []))
        pattern = group.get("pattern")

        grouped_checks = [
            check for check in check_columns
            if check in explicit or (pattern and re.match(pattern, check))
        ]
        if not grouped_checks:
            continue

        st.header(group_name)
        for check in grouped_checks:
            grouped_seen.add(check)
            _render_check(
                check, descriptions=descriptions, score_map=score_map, df=df,
                missing_desc=missing_desc, missing_remediation=missing_remediation,
            )

    ungrouped = [c for c in check_columns if c not in grouped_seen]
    if ungrouped:
        st.header("Other checks")
        for check in ungrouped:
            _render_check(
                check, descriptions=descriptions, score_map=score_map, df=df,
                missing_desc=missing_desc, missing_remediation=missing_remediation,
            )

    _render_up_for_review(check_columns)
    _render_candidates()


render()

from __future__ import annotations

from functools import partial

import pandas as pd
import streamlit as st

from dashboard.lib.config import get_feature_flags
from dashboard.data import load_config, load_my_repos, load_scored_baseline, load_scored_snapshot
from dashboard.lib.clock import now_utc
from dashboard.lib.ownership import OWNER_KEY, grade_mix, owner_key, owner_summary, repos_for_owner
from dashboard.lib.stewardship import DEFAULT_RULE, at_risk_repos, catalog_url
from dashboard.lib.scoring import calculate_scores
from dashboard.lib.ordering import rank
from dashboard.lib.share import share_link
from dashboard.ui import empty_state, page_init, repo_table, share_link_block


def _normalize_bucket(value: object) -> str:
    normalized = str(value).strip()
    return normalized if normalized else "Unassigned"


# catalog-info.yaml (spec.owner) is the primary source; the Google-Sheet
# theme/squad/priority columns are a secondary, 2U-only source.
_COVERAGE_COLS = [
    "ownership.owner_name",
    "ownership.owner",
    "ownership.theme",
    "ownership.squad",
    "ownership.priority",
]


def _has_data(df: pd.DataFrame, column: str) -> bool:
    return (
        column in df.columns
        and df[column].fillna("").astype(str).str.strip().ne("").any()
    )


def _ownership_coverage(df: pd.DataFrame) -> float:
    if df.empty:
        return 0.0
    existing = [col for col in _COVERAGE_COLS if col in df.columns]
    if not existing:
        return 0.0
    populated = pd.Series(False, index=df.index)
    for col in existing:
        populated = populated | df[col].fillna("").astype(str).str.strip().ne("")
    return round(float(populated.mean()) * 100, 2)


def _group_summary(df: pd.DataFrame, column: str) -> pd.DataFrame:
    if column not in df.columns:
        return pd.DataFrame()
    group_df = df.copy()
    group_df[column] = group_df[column].map(_normalize_bucket)
    summary = (
        group_df.groupby(column, as_index=False)
        .agg(
            repo_count=("repo_name", "count"),
            avg_score=("score_composite", "mean"),
            d_or_f=("score_letter", lambda series: int(series.isin(["D", "F"]).sum())),
        )
        .pipe(rank, ["repo_count", "avg_score"], ascending=[False, False], tiebreak=column)
    )
    summary["avg_score"] = summary["avg_score"].round(2)
    return summary


OWNER_PARAM = "owner"
OWNER_TABLE_KEY = "owner_summary_table"
# A table's row selection cannot be cleared from Python, so closing the owner
# panel moves the table to a fresh widget key.
OWNER_TABLE_GENERATION = "owner_summary_table_generation"

SUMMARY_COLUMNS = {
    "owner": st.column_config.TextColumn("Owner"),
    "owner_type": st.column_config.TextColumn("Type"),
    "repo_count": st.column_config.NumberColumn("Repositories"),
    "avg_score": st.column_config.NumberColumn("Average score", format="%.1f"),
    "d_or_f": st.column_config.NumberColumn("Grade D or F"),
    "at_risk": st.column_config.NumberColumn("At risk"),
}
OWNER_REPO_COLUMNS = {
    "catalog_link": st.column_config.LinkColumn("Backstage", display_text="Catalog"),
}


def _selected_owner() -> str:
    return owner_key(st.query_params.get(OWNER_PARAM, ""))


def _table_key() -> str:
    return f"{OWNER_TABLE_KEY}_{st.session_state.get(OWNER_TABLE_GENERATION, 0)}"


def _store_selection(summary: pd.DataFrame) -> None:
    rows = st.session_state[_table_key()].selection.rows
    chosen = str(summary.iloc[rows[0]][OWNER_KEY]) if rows else ""
    if chosen and chosen != _selected_owner():
        st.query_params[OWNER_PARAM] = chosen
    elif not chosen and OWNER_PARAM in st.query_params:
        del st.query_params[OWNER_PARAM]


def _clear_selection() -> None:
    if OWNER_PARAM in st.query_params:
        del st.query_params[OWNER_PARAM]
    st.session_state[OWNER_TABLE_GENERATION] = st.session_state.get(OWNER_TABLE_GENERATION, 0) + 1


def _render_owner_panel(df: pd.DataFrame, summary: pd.DataFrame, rule: dict) -> None:
    selected = _selected_owner()
    if not selected:
        st.caption("Select an owner's row to see its repositories.")
        return
    match = summary[summary[OWNER_KEY] == selected]
    if match.empty:
        empty_state("info", f"No owner named “{selected}” in this snapshot.", "It may have been renamed or removed.")
        return

    owner = match.iloc[0]
    repos = repos_for_owner(df, selected)
    template = rule.get("catalog_url_template", DEFAULT_RULE["catalog_url_template"])
    repos = repos.assign(catalog_link=repos["repo_name"].map(lambda repo: catalog_url(repo, template)))

    st.subheader(owner["owner"])
    st.caption(f"{owner['owner_type'].capitalize()} · {owner['repo_count']} repositories")
    cols = st.columns(4)
    cols[0].metric("Repositories", int(owner["repo_count"]))
    cols[1].metric("Average score", f"{owner['avg_score']:.1f}")
    cols[2].metric("Grade D or F", int(owner["d_or_f"]))
    cols[3].metric("At risk", int(owner["at_risk"]))
    mix = grade_mix(repos)
    st.caption("Grades: " + " · ".join(f"{letter} {count}" for letter, count in mix.items()))
    if owner["at_risk"]:
        st.caption(f"[See the at-risk repositories]({share_link({'tab': 'at-risk'})})")

    repo_table(
        repos,
        columns=["repo_name", "score_composite", "score_letter", "score_activity", "lifecycle", "release", "catalog_link"],
        link_to_detail=True,
        extra_config=OWNER_REPO_COLUMNS,
    )
    share_link_block(share_link({"tab": "ownership", OWNER_PARAM: selected}), label="Copy link to this owner")
    st.button("Close owner details", on_click=_clear_selection)


def _render_by_owner(df: pd.DataFrame) -> None:
    rule = {**DEFAULT_RULE, **load_config("attention_rules").get("rules", {}).get("stewardship_risk", {})}
    baseline, _ = load_scored_baseline()
    at_risk = set(at_risk_repos(df, baseline, now=now_utc(), rule=rule).get("repo_name", []))
    summary = owner_summary(df, unmaintained_group=rule["unmaintained_group"], at_risk_repos=at_risk)
    st.caption("Select a row to explore that owner's repositories.")
    repo_table(
        summary,
        columns=list(SUMMARY_COLUMNS),
        extra_config=SUMMARY_COLUMNS,
        height=360,
        empty_message="No owners found.",
        select_key=_table_key(),
        on_select=partial(_store_selection, summary),
    )
    _render_owner_panel(df, summary, rule)


def render() -> None:
    page_init()
    st.title("Owners")

    if not get_feature_flags().get("enable_maintainer_views", True):
        empty_state(
            "info",
            "Maintainer views are switched off for this deployment.",
            "Enable `enable_maintainer_views` in `dashboard/config/feature_flags.yaml`.",
        )
        return

    df = load_scored_snapshot()
    if df.empty:
        empty_state(
            "error",
            "No snapshot available.",
            "The upstream CSV and the local cache are both empty.",
        )
        return

    coverage = _ownership_coverage(df)
    st.metric("Ownership Coverage", f"{coverage}%")
    st.caption(
        "Ownership is sourced primarily from each repo's `catalog-info.yaml` "
        "(`spec.owner`, per OEP-55). Theme/Squad come from the working-group "
        "spreadsheet and are only present for orgs that maintain it."
    )
    if coverage < 20:
        st.warning(
            "Ownership data is not yet populated for most repositories, so these "
            "views are mostly empty. To appear here, a repository needs "
            "`spec.owner` set in its `catalog-info.yaml` (OEP-55)."
        )

    # By Owner is primary (catalog-info). Theme/Squad tabs only appear when the
    # secondary spreadsheet columns actually carry data.
    owner_col = next(
        (col for col in ("ownership.owner_name", "ownership.owner") if _has_data(df, col)),
        None,
    )
    tab_labels = ["By Owner"]
    if _has_data(df, "ownership.theme"):
        tab_labels.append("By Theme")
    if _has_data(df, "ownership.squad"):
        tab_labels.append("By Squad")
    tab_labels.append("My Repos")
    tabs = dict(zip(tab_labels, st.tabs(tab_labels)))

    with tabs["By Owner"]:
        if owner_col is None:
            empty_state(
                "info",
                "No owner data in this snapshot.",
                "A repository appears here once its `catalog-info.yaml` sets "
                "`spec.owner` (OEP-55). None currently do.",
            )
        else:
            _render_by_owner(df)

    if "By Theme" in tabs:
        with tabs["By Theme"]:
            repo_table(_group_summary(df, "ownership.theme"), empty_message="No themes found.")

    if "By Squad" in tabs:
        with tabs["By Squad"]:
            repo_table(_group_summary(df, "ownership.squad"), empty_message="No squads found.")

    with tabs["My Repos"]:
        if not get_feature_flags().get("enable_my_repos_filter", True):
            empty_state(
                "info",
                "This view is switched off for this deployment.",
                "Enable `enable_my_repos_filter` in `dashboard/config/feature_flags.yaml`.",
            )
        else:
            st.caption(
                "Matches GitHub handle against repo owner from repo_name and ownership/maintainer fields when available."
            )
            handle = st.text_input("GitHub handle", value="", placeholder="e.g. openedx")
            if handle.strip():
                mine = calculate_scores(load_my_repos(handle.strip()))
                if mine.empty:
                    empty_state(
                        "info",
                        "No repositories matched that handle.",
                        "Ownership fields are largely unpopulated, so most repositories "
                        "cannot be matched to anyone yet.",
                    )
                else:
                    repo_table(
                        rank(mine, "score_composite", ascending=False),
                        columns=["repo_name", "score_composite", "score_letter"],
                        link_to_detail=True,
                        use_progress=True,
                    )

    share_link_block(
        share_link({"tab": "ownership", "coverage": f"{coverage:.2f}"}),
        label="Copy link to this view",
    )


render()

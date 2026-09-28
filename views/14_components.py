from __future__ import annotations

import pandas as pd
import streamlit as st

from dashboard.data import load_maintenance, load_scored_snapshot
from dashboard.lib import catalog
from dashboard.lib.schema import REPO_COL
from dashboard.lib.share import share_link
from dashboard.ui import empty_state, page_init, repo_table, share_link_block

BACKSTAGE_URL = "https://backstage.openedx.org/catalog"
ALL = "All"

COMPONENT_COLUMNS = {
    "type": st.column_config.TextColumn("Type", width="small"),
    "lifecycle": st.column_config.TextColumn("Lifecycle", width="small"),
    "owner": st.column_config.TextColumn("Owner"),
    "release": st.column_config.TextColumn("Release", width="small"),
    "score_letter": st.column_config.TextColumn("Grade", width="small"),
    "finding_count": st.column_config.NumberColumn("Findings", width="small"),
    "backstage_url": st.column_config.LinkColumn("Backstage", display_text="Backstage"),
}
RELATION_COLUMNS = {
    "relation": st.column_config.TextColumn("Relation", width="small"),
    "target": st.column_config.TextColumn("Target"),
    "status": st.column_config.TextColumn("Status"),
}
FINDING_REPO_COLUMNS = {
    "score_letter": st.column_config.TextColumn("Grade", width="small"),
    "owner": st.column_config.TextColumn("Owner"),
}


def _collected(payload: dict) -> str:
    return str(payload["metadata"].get("generated_at", ""))[:16].replace("T", " ") + " UTC"


def _render_summary(payload: dict) -> None:
    summary = payload["metadata"].get("summary") or {}
    repos, with_file, with_problem = (summary.get(key, 0) for key in ("repos", "with_file", "with_problem"))
    columns = st.columns(3)
    columns[0].metric("Repositories", repos)
    columns[1].metric("With catalog-info.yaml", with_file, help=f"{repos - with_file} have none.")
    columns[2].metric("With a problem to fix", with_problem)


def _render_findings(payload: dict, components: pd.DataFrame) -> None:
    st.header("Catalog issues")
    rows = catalog.finding_rows(payload)
    if not rows:
        empty_state("good", "Every repository's catalog entry is complete.")
        return
    st.caption("Problems stop Backstage or this dashboard from reading the entry correctly; notes are worth a look.")
    for row in rows:
        kind = "Problem" if row["severity"] == catalog.PROBLEM else "Note"
        with st.expander(f"**{row['label']}** · {len(row['repos'])} repos · {kind}"):
            affected = components[components[REPO_COL].isin(row["repos"])]
            repo_table(
                affected,
                columns=[REPO_COL, "score_letter", "owner"],
                extra_config=FINDING_REPO_COLUMNS,
                link_to_detail=True,
            )


def _choice(label: str, values: pd.Series, key: str) -> str:
    options = [ALL] + sorted({str(value) for value in values.dropna() if str(value)})
    return st.selectbox(label, options, key=key)


def _render_components(components: pd.DataFrame) -> None:
    st.header("Components")
    declared = components[components["has_file"]]
    type_col, lifecycle_col, release_col = st.columns(3)
    with type_col:
        chosen_type = _choice("Type", declared["type"], "components_type")
    with lifecycle_col:
        chosen_lifecycle = _choice("Lifecycle", declared["lifecycle"], "components_lifecycle")
    with release_col:
        chosen_release = st.selectbox("Release", [ALL, "In a named release", "Not in a release"], key="components_release")
    filtered = declared
    if chosen_type != ALL:
        filtered = filtered[filtered["type"] == chosen_type]
    if chosen_lifecycle != ALL:
        filtered = filtered[filtered["lifecycle"] == chosen_lifecycle]
    if chosen_release != ALL:
        in_release = filtered["release"].notna() & filtered["release"].astype(str).ne("")
        filtered = filtered[in_release if chosen_release == "In a named release" else ~in_release]
    st.caption(f"{len(filtered)} of {len(declared)} declared components.")
    repo_table(
        filtered.assign(release=filtered["release"].fillna("no")),
        columns=[REPO_COL, *COMPONENT_COLUMNS],
        extra_config=COMPONENT_COLUMNS,
        link_to_detail=True,
        height=460,
        empty_message="No components match these filters.",
    )


def _render_relations(payload: dict) -> None:
    rows = catalog.relation_rows(payload)
    if not rows:
        return
    st.header("Declared relations")
    st.caption("`dependsOn`, `subcomponentOf` and `dependencyOf`, checked against the entity names declared in the org.")
    repo_table(pd.DataFrame(rows), columns=[REPO_COL, *RELATION_COLUMNS], extra_config=RELATION_COLUMNS)


def render() -> None:
    page_init()
    st.title("Components")
    st.markdown(
        "What each repository declares in its `catalog-info.yaml`: the same files "
        f"[Backstage]({BACKSTAGE_URL}) reads, joined here with health grades, and checked "
        "for entries that are missing or half-filled."
    )
    payload = load_maintenance(catalog.CATALOG_FILE)
    if payload is None:
        empty_state(
            "info",
            "No catalog snapshot yet.",
            "It is published daily by the collect-maintenance workflow; check back after its next run.",
        )
        return
    st.caption(
        f"Collected {_collected(payload)} from each repo's default branch. User owners are checked "
        "against GitHub; group owners are not, since that needs openedx org membership."
    )
    components = catalog.components_frame(payload, load_scored_snapshot())
    _render_summary(payload)
    _render_findings(payload, components)
    _render_components(components)
    _render_relations(payload)
    share_link_block(share_link({"tab": "components"}), label="Copy link to this view")


render()

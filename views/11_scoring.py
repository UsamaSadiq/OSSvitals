from __future__ import annotations

import pandas as pd
import streamlit as st

from dashboard.data import load_config, load_proposed_scored_snapshot, load_scored_snapshot
from dashboard.lib.proposed_scoring import grade_changes, grade_migration, swap_rows
from dashboard.lib.scoring_method import letter_bands, metric_rows
from dashboard.lib.share import share_link
from dashboard.ui import empty_state, page_init, repo_table, share_link_block

SCORES_FILE_URL = "https://github.com/UsamaSadiq/org-health-dashboard/blob/data/openedx/scores.json"

METRIC_COLUMNS = {
    "metric": st.column_config.TextColumn("Metric"),
    "category": st.column_config.TextColumn("Category", width="small"),
    "weight_pct": st.column_config.NumberColumn("Weight", format="%.0f%%"),
    "measured_pct": st.column_config.NumberColumn("Measured", format="%.0f%%"),
    "defaulted_pct": st.column_config.NumberColumn("Defaulted", format="%.0f%%"),
    "chaoss_metric": st.column_config.TextColumn("CHAOSS metric"),
}


def _render_overview(version: str) -> None:
    st.markdown(
        "Each repository gets a score from 0 to 100: a weighted average of the metrics "
        "below, each scored 0 to 100 from public data collected by the daily "
        "[edx-repo-health](https://github.com/openedx/edx-repo-health) checks. The score "
        "maps to a letter grade. Weights, thresholds and grade bands are read from "
        f"`scoring.yaml` (version {version}), not hardcoded."
    )
    st.markdown(
        "Scores can be recomputed by anyone: the inputs are the public CSVs in "
        "[openedx/wg-maintenance](https://github.com/openedx/wg-maintenance/tree/main/dashboards), "
        "and the daily output is published as "
        f"[`scores.json`]({SCORES_FILE_URL}) by `scripts/build_scores.py`."
    )


def _bands_line(bands: list[dict]) -> str:
    return " · ".join(f"**{band['grade']}** {band['from']}–{band['to']}" for band in bands)


def _render_rules(rows: list[dict]) -> None:
    st.subheader("How each metric is scored")
    for row in rows:
        st.markdown(f"- **{row['metric']}** (`{row['source']}`): {row['rule']}")


def _render_missing_data_policy(rows: list[dict]) -> None:
    st.header("Missing data")
    defaults = sorted({row["missing_scores_as"] for row in rows})
    default_text = ", ".join(str(value) for value in defaults)
    st.markdown(
        f"When a metric's value is blank or unreadable for a repo, it scores **{default_text}** "
        "rather than 0, so a gap in collection is not reported as a failure. The table "
        "shows how often that happens today, per metric. A repo detail page marks each "
        "defaulted metric so a score built mostly on defaults is visible."
    )


def _render_limitations(rows: list[dict]) -> None:
    limited = [row for row in rows if row["limitation"]]
    provisional = [row["metric"] for row in rows if row["provisional"]]
    if not limited and not provisional:
        return
    st.header("Known limitations")
    for row in limited:
        st.markdown(f"- **{row['metric']}**: {row['limitation']}")
    if provisional:
        st.markdown(
            f"- **Provisional thresholds** ({', '.join(provisional)}): set from current data "
            "and awaiting review by the Open edX Maintenance Working Group."
        )


SWAP_COLUMNS = {
    "metric": st.column_config.TextColumn("Metric"),
    "replaces": st.column_config.TextColumn("Replaces"),
    "rule": st.column_config.TextColumn("Proposed rule"),
    "measured_pct": st.column_config.NumberColumn("Measured", format="%.0f%%"),
}

CHANGE_COLUMNS = {
    "repo_name": st.column_config.TextColumn("Repository"),
    "current": st.column_config.TextColumn("Current", width="small"),
    "proposed": st.column_config.TextColumn("Proposed", width="small"),
    "change": st.column_config.NumberColumn("Score change", format="%+.1f"),
}


def _render_pending_inputs(swaps: list[dict]) -> None:
    pending = [row for row in swaps if not row["in_snapshot"]]
    if not pending:
        return
    names = ", ".join(f"**{row['metric']}** (`{row['source']}`)" for row in pending)
    empty_state(
        "info",
        f"Not in this snapshot yet: {names}.",
        "The upstream checks that report these are pending, so the comparison below keeps "
        "the current metric in their place until they arrive.",
    )


def _render_proposed(live_scored: pd.DataFrame) -> None:
    proposed_config = load_config("scoring_proposed")
    if not proposed_config.get("metrics"):
        return
    proposed_scored = load_proposed_scored_snapshot()
    swaps = swap_rows(proposed_config, proposed_scored)

    st.header("Proposed changes")
    st.markdown(
        f"Scoring version {proposed_config.get('version', 'unknown')} replaces metrics that "
        "reward a file or a tool being set up with ones that measure the outcome. It is "
        "**not live**: every grade on this dashboard still uses the method above until the "
        "Open edX Maintenance Working Group agrees the change."
    )
    repo_table(pd.DataFrame(swaps), columns=list(SWAP_COLUMNS), extra_config=SWAP_COLUMNS)
    _render_pending_inputs(swaps)

    st.subheader("How grades would move")
    migration = grade_migration(live_scored, proposed_scored).reset_index()
    repo_table(migration, columns=list(migration.columns))
    st.caption("Rows are today's grades, columns the proposed ones; the diagonal is unchanged.")
    changes = grade_changes(live_scored, proposed_scored)
    if changes.empty:
        empty_state("info", "No repository changes letter grade under the proposed method.")
        return
    st.markdown(f"{len(changes)} repositories would change letter grade:")
    repo_table(changes, columns=list(CHANGE_COLUMNS), extra_config=CHANGE_COLUMNS)


def _render_never_paid_rule() -> None:
    st.header("Independence")
    st.markdown(
        "Payment never buys ranking, visibility, score changes, early access to public "
        "results, or removal of a public result. Every check, weight, threshold and score "
        "for public repositories stays open and reproducible."
    )


def render() -> None:
    page_init()
    st.title("How Scoring Works")

    config = load_config("scoring")
    if not config.get("metrics"):
        empty_state(
            "error",
            "No scoring configuration found.",
            "Expected `dashboard/config/openedx/scoring.yaml` with a `metrics` section.",
        )
        return

    scored = load_scored_snapshot()
    rows = metric_rows(config, scored)
    _render_overview(str(config.get("version", "unknown")))

    st.header("Grade bands")
    st.markdown(_bands_line(letter_bands(config)))

    st.header("Metrics")
    repo_table(
        pd.DataFrame(rows),
        columns=list(METRIC_COLUMNS),
        extra_config=METRIC_COLUMNS,
    )
    st.caption(
        "Measured: share of repos with a usable value today. Defaulted: share scored with "
        "the missing-data value instead. Structural metrics describe repo setup; activity "
        "metrics describe recent development."
    )
    _render_rules(rows)

    _render_missing_data_policy(rows)
    _render_limitations(rows)
    _render_proposed(scored)
    _render_never_paid_rule()

    share_link_block(share_link({"tab": "scoring"}), label="Copy link to this view")


render()

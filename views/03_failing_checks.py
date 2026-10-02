from __future__ import annotations

import streamlit as st

from dashboard.data import load_scored_snapshot
from dashboard.lib.checks import check_columns, failing_counts, failing_mask
from dashboard.lib.ordering import rank
from dashboard.lib.share import share_link
from dashboard.ui import empty_state, page_init, repo_table, share_link_block
from dashboard.ui.charts import top_failing_bar


def render() -> None:
    page_init()
    st.title("Failing Checks")

    df = load_scored_snapshot()
    if df.empty:
        empty_state(
            "error",
            "No snapshot available.",
            "The upstream CSV and the local cache are both empty. This usually "
            "clears on its own within a few minutes.",
        )
        return

    check_cols = check_columns(df.columns)
    if not check_cols:
        empty_state(
            "warn",
            "No check columns found in this snapshot.",
            "The upstream CSV may have changed shape.",
        )
        return

    fail_df = failing_counts(df, check_cols)
    if fail_df.empty:
        empty_state(
            "good",
            "No failing checks detected.",
            "Every collected check passes across the whole organisation.",
        )
        return

    st.header("Most-failed checks")

    # The themed lollipop chart, not a raw px.bar. The previous chart gave every
    # one of ~40 checks its own colour, rotated the labels into an unreadable
    # overlapping band, and emitted a legend that listed six series and then cut
    # off (backlog E1, and the readable half of D26). Capped and disclosed rather
    # than silently truncated.
    TOP_N = 15
    shown = fail_df.head(TOP_N)
    st.plotly_chart(
        top_failing_bar(shown),
        width="stretch",
        config={"displayModeBar": False},
    )
    if len(fail_df) > TOP_N:
        st.caption(
            f"Showing the {TOP_N} most-failed of {len(fail_df)} failing checks. "
            "Use the selector below to inspect any of them."
        )

    # An explicit selector alongside the chart. Click-to-filter was wired via
    # on_select but nothing said so, and it needed a precise click on a 12px bar
    # (D27). A selectbox is discoverable and keyboard-reachable; it also survives
    # the chart being capped at TOP_N, which click-to-filter would not.
    check_options = ["All repositories"] + fail_df["check"].astype(str).tolist()
    chosen = st.selectbox(
        "Inspect a check",
        options=check_options,
        index=0,
        help="Narrow the table to the repositories failing one specific check.",
    )
    selected_check = None if chosen == check_options[0] else chosen

    filtered = df
    if selected_check:
        filtered = filtered[failing_mask(filtered[selected_check])]
        st.caption(f"{len(filtered)} repositories fail `{selected_check}`.")

    result = rank(filtered[["repo_name", "score_composite", "score_letter"]], "score_composite")
    repo_table(
        result,
        link_to_detail=True,
        empty_message="No repositories fail the selected check.",
    )
    share_link_block(
        share_link({"tab": "failing-checks", "category": selected_check or ""}),
        label="Copy link to this view",
    )


render()

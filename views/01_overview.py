from __future__ import annotations


import pandas as pd
import streamlit as st

from dashboard.data import export_json_payload, load_config, load_scored_snapshot
from dashboard.lib.activity import org_totals, unmeasured_columns
from dashboard.lib.checks import category_pass_rates
from dashboard.lib.clock import now_utc
from dashboard.lib.ordering import bottom, rank, top
from dashboard.lib.overview import top_failing, top_movers
from dashboard.lib.schema import TIMESTAMP_COL, parse_snapshot_date
from dashboard.lib.share import share_link
from dashboard.lib.tiers import tier_counts
from dashboard.data import load_scored_history
from dashboard.ui import (
    page_init,
    render_freshness_banner,
    card,
    render_empty_state,
    render_repo_pill_list,
    render_sidebar_filters,
    repo_table,
    share_link_block,
)
from dashboard.ui.charts import (
    category_pass_rate_bar,
    grade_histogram,
    grade_ribbon,
    top_failing_bar,
)
from dashboard.ui.kpi import render_kpi_strip


def _baseline_frame() -> pd.DataFrame | None:
    """Return the earliest snapshot in the last 7 days, scored, for KPI deltas."""
    try:
        history = load_scored_history(days=7)
    except Exception:
        return None
    if len(history) < 2:
        return None
    return history[0].df


def _history_span() -> tuple[object, object] | None:
    """First and last snapshot dates actually available, for labelling.

    Charts used to be captioned "30d" regardless of what history existed, and the
    local cache can be months stale relative to the current snapshot, so a trend
    line could be labelled as recent while showing May data under a July
    snapshot. Callers label with the real span instead.
    """
    try:
        history = load_scored_history(days=30)
    except Exception:
        return None
    if len(history) < 2:
        return None
    return history[0].timestamp, history[-1].timestamp


def _movers_baseline() -> pd.DataFrame | None:
    try:
        history = load_scored_history(days=30)
    except Exception:
        return None
    if len(history) < 2:
        return None
    return history[0].df


def render() -> None:
    page_init()
    df = load_scored_snapshot()
    if df.empty:
        st.title("Open edX Repository Health Dashboard")
        render_empty_state(
            title="No snapshot available",
            body="Upstream CSV and local cache are both empty. Try again in a few minutes.",
            icon="cloud_off",
        )
        if st.button("Retry", type="primary"):
            st.rerun()
        return

    snapshot_date = (
        parse_snapshot_date(df[TIMESTAMP_COL].iloc[0]) if TIMESTAMP_COL in df.columns else None
    )

    data_cfg = load_config("data_source")
    stale_hours = int(data_cfg.get("stale_threshold_hours", 48))
    critical_hours = int(data_cfg.get("critically_stale_threshold_hours", 168))

    # ------------------------------------------------------------------ header
    st.title("Open edX Repository Health")
    # The snapshot date already appears under the gauge, and "drill in via the
    # sidebar nav" told the reader nothing they could not see. Use the configured
    # tagline instead, which was defined in org_branding.yaml and never rendered.
    branding = load_config("org_branding")
    tagline = str(branding.get("tagline") or "").strip()
    if tagline:
        st.caption(tagline)

    filters = render_sidebar_filters(
        snapshot_date=snapshot_date,
        stale_hours=stale_hours,
        critical_hours=critical_hours,
        tier_counts=tier_counts(df),
    )
    working = filters.apply(df)
    filters.report_result_count(len(working), len(df))

    if working.empty:
        empty_state(
            "info",
            "No repositories match the current filters.",
            "Clear the search box or widen the tier filter in the sidebar.",
        )
        return

    # Snapshot age, in the main content area. Until now the only signal was a
    # small amber dot on a chip partway down a dark sidebar, for data three days
    # past its own stale threshold (C2/E10). Renders nothing when fresh.
    render_freshness_banner(snapshot_date, stale_hours, critical_hours)

    # A composite built half from default_when_missing needs saying out loud,
    # above the fold, not implying in a tile. See docs/UX_REVIEW_BACKLOG.md B1.
    measured = (
        float(working["score_measured_weight"].mean())
        if "score_measured_weight" in working.columns
        else 1.0
    )
    if measured < 0.8:
        missing = sorted(
            {
                name
                for metrics in working.get("score_unavailable_metrics", [])
                if isinstance(metrics, list)
                for name in metrics
            }
        )
        st.warning(
            f"**Scores are directional.** Only {measured:.0%} of the scoring weight "
            f"can be computed from this snapshot; the rest falls back to a fixed "
            f"default of 50, which moves no repository up or down relative to any "
            f"other. Not collected: {', '.join(missing) if missing else 'unknown'}."
        )

    # ----------------------------------------------------------- 1. signals
    baseline = _baseline_frame()
    scoped_baseline = filters.apply(baseline) if baseline is not None else None
    render_kpi_strip(
        working,
        baseline=scoped_baseline,
        snapshot_date=snapshot_date,
        stale_hours=stale_hours,
    )

    activity_totals = org_totals(working, skip=unmeasured_columns(df))
    if activity_totals:
        st.caption(f"Across {len(working):,} repositories: " + " · ".join(activity_totals))

    # --------------------------------------------------- 1b. grade ribbon
    st.header("Grade mix")
    st.plotly_chart(
        grade_ribbon(working),
        width="stretch",
        config={"displayModeBar": False},
    )

    # ------------------------------------------------------- 2. primary chart
    primary_tab, category_tab, failing_tab = st.tabs(
        ["Grade distribution", "Per-category pass rate", "Top failing checks"]
    )
    with primary_tab:
        st.plotly_chart(grade_histogram(working), width="stretch")
    with category_tab:
        category_df = category_pass_rates(working)
        if category_df.empty:
            empty_state(
                "warn",
                "No categorisable check columns in this snapshot.",
                "The upstream CSV may have changed shape; per-category rates cannot "
                "be computed.",
            )
        else:
            st.plotly_chart(category_pass_rate_bar(category_df), width="stretch")
    with failing_tab:
        fail_df = top_failing(working)
        if fail_df.empty:
            empty_state(
                "good",
                "No failing checks in the current filter scope.",
                "Every check passes for the repositories currently shown.",
            )
        else:
            st.plotly_chart(top_failing_bar(fail_df), width="stretch")
            st.caption("Drill down on individual checks in **Failing Checks**.")

    # ---------------------------------------------- 3. ranked tables + movers
    ranked = rank(
        working[["repo_name", "score_composite", "score_letter"]],
        "score_composite",
        ascending=False,
    )

    st.header(":material/leaderboard: Highlights")

    def _repo_link(repo: str) -> str:
        return share_link({"tab": "detail", "repo": repo})

    top_rows = [
        (str(r.repo_name), float(r.score_composite), str(r.score_letter))
        for r in ranked.head(5).itertuples(index=False)
    ]
    # bottom(), not ranked.tail(5).iloc[::-1]. Reversing the ranked frame also
    # reverses its alphabetical tiebreak, so a tie straddling the cut selected
    # the alphabetically *last* of the tied repos: with two repos on 36.67, the
    # list showed openedx/training-courses where every other bottom-ranking path
    # shows openedx/olxcleaner. Same scores, different answer per call site.
    bottom_rows = [
        (str(r.repo_name), float(r.score_composite), str(r.score_letter))
        for r in bottom(working, "score_composite", 5).itertuples(index=False)
    ]
    hi_left, hi_right = st.columns(2)
    with hi_left:
        st.markdown("**Top 5**")
        render_repo_pill_list(top_rows, link_fn=_repo_link)
    with hi_right:
        st.markdown("**Bottom 5**")
        render_repo_pill_list(bottom_rows, link_fn=_repo_link)

    movers = top_movers(working, _movers_baseline())
    if not movers.empty:
        span = _history_span()
        # Label with the real span. "(30d)" was hardcoded regardless of how much
        # history existed, and the cached history can be months behind the
        # snapshot, so the label could claim recency the data did not have.
        span_label = (
            f"{span[0].isoformat()} → {span[1].isoformat()}"
            if span
            else "available history"
        )
        gainers = top(movers[movers["delta"] > 0], "delta", 5)
        # bottom() over a negative filter, not tail(): sorting descending and
        # taking the tail labels the five smallest *gains* as losses whenever
        # every repository improved.
        losers = bottom(movers[movers["delta"] < 0], "delta", 5)

        mv_left, mv_right = st.columns(2)
        with mv_left:
            st.markdown("**Biggest gainers**")
            repo_table(
                gainers,
                columns=["repo_name", "delta"],
                empty_message="No repositories improved over this window.",
            )
        with mv_right:
            st.markdown("**Biggest losers**")
            repo_table(
                losers,
                columns=["repo_name", "delta"],
                empty_message="No repositories declined over this window.",
            )
        st.caption(f"Composite score change · {span_label} (UTC)")

    # ---------------------------------------- 4. full table (collapsed default)
    with st.expander(f"Full table — {len(ranked)} repos", expanded=False):
        # Bounded height so the workhorse table stays navigable instead of
        # running to several thousand pixels; the score bar makes the ranking
        # readable at a glance (backlog D11).
        repo_table(
            ranked,
            link_to_detail=True,
            use_progress=True,
            height=460,
        )

    # --------------------------------------------- 5. share + export footer
    state = {"tab": "overview", **filters.as_query_params()}
    with st.expander(":material/share: Share & export", expanded=False):
        share_link_block(share_link(state), label="Copy link to this view")

        export_name = f"openedx-health-{now_utc().date().isoformat()}"
        dl_left, dl_right = st.columns(2)
        dl_left.download_button(
            "Download CSV",
            data=ranked.to_csv(index=False).encode("utf-8"),
            file_name=f"{export_name}.csv",
            mime="text/csv",
        )
        json_payload = export_json_payload(
            ranked,
            {
                "snapshot_timestamp": snapshot_date.isoformat() if snapshot_date else "unknown",
                "filters": state,
                "scoring_config_version": str(working.get("score_config_version", pd.Series(["unknown"])).iloc[0]),
                "dashboard_version": "1.0.0",
                "data_source_url": data_cfg.get("data_source_url", data_cfg.get("csv_url", "")),
            },
        )
        dl_right.download_button(
            "Download JSON",
            data=json_payload.encode("utf-8"),
            file_name=f"{export_name}.json",
            mime="application/json",
        )


render()

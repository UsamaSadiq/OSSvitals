"""Org-level summaries for the Overview page, free of Streamlit and loaders."""
from __future__ import annotations

import pandas as pd

from dashboard.lib.checks import check_columns, failing_counts
from dashboard.lib.ordering import rank


def top_failing(frame: pd.DataFrame, limit: int = 10) -> pd.DataFrame:
    columns = check_columns(frame.columns, skip_prefixes=("github.",))
    return failing_counts(frame, columns).head(limit)


def top_movers(frame: pd.DataFrame, baseline: pd.DataFrame | None) -> pd.DataFrame:
    """Composite change per repository against ``baseline``, biggest gain first."""
    if baseline is None:
        return pd.DataFrame()
    merged = frame[["repo_name", "score_composite"]].merge(
        baseline[["repo_name", "score_composite"]].rename(columns={"score_composite": "baseline_score"}),
        on="repo_name",
        how="inner",
    )
    if merged.empty:
        return pd.DataFrame()
    merged["delta"] = (merged["score_composite"] - merged["baseline_score"]).round(2)
    return rank(merged, "delta", ascending=False)

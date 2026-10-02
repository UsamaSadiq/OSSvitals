"""Org-level summaries for the Overview page, free of Streamlit and loaders."""
from __future__ import annotations

from datetime import date, datetime

import pandas as pd

from dashboard.lib.checks import check_columns, failing_counts
from dashboard.lib.ordering import rank
from dashboard.lib.schema import LAST_PUSH_COL, parse_last_push_utc
from dashboard.lib.trends import Snapshot


def top_failing(frame: pd.DataFrame, limit: int = 10) -> pd.DataFrame:
    columns = check_columns(frame.columns)
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


def stale_count(df: pd.DataFrame, stale_hours: int, now: datetime) -> int:
    if LAST_PUSH_COL not in df.columns:
        return 0
    threshold = now.timestamp() - stale_hours * 3600
    pushes = (parse_last_push_utc(value) for value in df[LAST_PUSH_COL])
    return sum(1 for pushed in pushes if pushed is not None and pushed.timestamp() < threshold)


def org_kpis(df: pd.DataFrame, stale_hours: int, now: datetime) -> dict[str, float | int]:
    """Headline numbers for an org; measured weight falls back to coverage for older frames."""
    total = len(df)
    avg_coverage = float(df["score_coverage"].mean()) if "score_coverage" in df.columns and total else 0.0
    measured = "score_measured_weight" in df.columns and total
    return {
        "repos": total,
        "avg_composite": float(df["score_composite"].mean()) if total else 0.0,
        "grade_a": int((df["score_letter"] == "A").sum()),
        "grade_f": int((df["score_letter"] == "F").sum()),
        "stale": stale_count(df, stale_hours, now),
        "avg_coverage": avg_coverage,
        "avg_measured_weight": float(df["score_measured_weight"].mean()) if measured else avg_coverage,
    }


def org_average_series(history: list[Snapshot]) -> list[tuple[date, float]]:
    return [
        (snapshot.timestamp, float(snapshot.df["score_composite"].mean()))
        for snapshot in history
        if "score_composite" in snapshot.df.columns
    ]

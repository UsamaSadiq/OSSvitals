"""Flag checks whose values no longer tell repositories apart.

A check is up for review when, in every snapshot of the retained history, one
value holds at least ``SATURATION_SHARE`` of the repos that report it
(saturated), or fewer than ``SPARSE_FILL`` of repos report it at all (sparse).
Review means "raise with the Maintenance WG", not retire: a saturated check may
still be worth keeping to catch regressions, and a sparse one may be a parser bug.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import pandas as pd

from dashboard.lib.trends import Snapshot

SATURATION_SHARE = 0.97
SPARSE_FILL = 0.10
SATURATED = "saturated"
SPARSE = "sparse"


@dataclass(frozen=True)
class ReviewWindow:
    snapshots: int
    first: date | None
    last: date | None


@dataclass(frozen=True)
class ColumnProfile:
    fill: float
    dominant: str | None
    share: float | None
    outliers: int


def _normalised(series: pd.Series) -> pd.Series:
    values = series.dropna().astype(str).str.strip()
    return values[values.ne("") & values.str.lower().ne("nan")].str.lower()


def profile(series: pd.Series) -> ColumnProfile:
    values = _normalised(series)
    fill = len(values) / len(series) if len(series) else 0.0
    if values.empty:
        return ColumnProfile(fill=fill, dominant=None, share=None, outliers=0)
    counts = values.value_counts()
    return ColumnProfile(
        fill=fill,
        dominant=str(counts.index[0]),
        share=counts.iloc[0] / len(values),
        outliers=int(len(values) - counts.iloc[0]),
    )


def _kind(column_profile: ColumnProfile) -> str | None:
    if column_profile.fill < SPARSE_FILL:
        return SPARSE
    if column_profile.share is not None and column_profile.share >= SATURATION_SHARE:
        return SATURATED
    return None


def review_window(snapshots: list[Snapshot]) -> ReviewWindow:
    stamps = [snapshot.timestamp for snapshot in snapshots]
    return ReviewWindow(snapshots=len(stamps), first=min(stamps, default=None), last=max(stamps, default=None))


def up_for_review(snapshots: list[Snapshot], columns: list[str]) -> pd.DataFrame:
    """One row per column flagged the same way in every snapshot, from the latest snapshot's profile."""
    ordered = sorted(snapshots, key=lambda snapshot: snapshot.timestamp)
    if not ordered:
        return pd.DataFrame(columns=["check", "kind", "dominant", "share_pct", "fill_pct", "outliers"])
    rows = []
    for column in columns:
        kinds = {
            _kind(profile(snapshot.df[column])) if column in snapshot.df.columns else None
            for snapshot in ordered
        }
        if len(kinds) != 1 or None in kinds:
            continue
        latest = profile(ordered[-1].df[column])
        rows.append(
            {
                "check": column,
                "kind": kinds.pop(),
                "dominant": latest.dominant,
                "share_pct": round(latest.share * 100, 1) if latest.share is not None else None,
                "fill_pct": round(latest.fill * 100, 1),
                "outliers": latest.outliers,
            }
        )
    return pd.DataFrame(rows, columns=["check", "kind", "dominant", "share_pct", "fill_pct", "outliers"])

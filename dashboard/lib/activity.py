"""Issue, PR backlog, CI and newcomer signals from the upstream ``check_pr_activity`` check.

Every value is a per-repo aggregate: the upstream check never emits authors, and
this module only sums or counts across repos. Columns absent from a snapshot are
skipped rather than shown as zero, since older snapshots predate the check.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

import pandas as pd

SECONDS_PER_HOUR = 3600
SECONDS_PER_DAY = 86400
CI_FAILING_STATES = {"FAILURE", "ERROR"}
CI_COLUMN = "github.default_branch_ci_state"
FIRST_TIMER_COLUMN = "github.first_timer_prs_90d"
NEWCOMER_COLUMNS = frozenset({FIRST_TIMER_COLUMN, "github.first_timer_median_first_response_seconds"})


def _count(value: Any) -> str:
    return f"{int(value):,}"


def _ratio(value: Any) -> str:
    return f"{float(value):.0%}"


def _days(value: Any) -> str:
    days = int(value)
    return f"{days:,} day" + ("" if days == 1 else "s")


def _duration(value: Any) -> str:
    seconds = float(value)
    if seconds < SECONDS_PER_DAY:
        return f"{seconds / SECONDS_PER_HOUR:.1f} h"
    return f"{seconds / SECONDS_PER_DAY:.1f} days"


def _state(value: Any) -> str:
    return str(value).strip().capitalize()


@dataclass(frozen=True)
class Signal:
    column: str
    label: str
    formatter: Callable[[Any], str]
    group: str


SIGNALS = (
    Signal("github.issues_open", "Open issues", _count, "Issues"),
    Signal("github.issues_opened_90d", "Opened (90 days)", _count, "Issues"),
    Signal("github.issue_closure_ratio_90d", "Closed of those", _ratio, "Issues"),
    Signal("github.median_issue_first_response_seconds", "Median first response", _duration, "Issues"),
    Signal("github.issues_stale_open_180d", "Open over 180 days", _count, "Issues"),
    Signal("github.prs_open", "Open PRs", _count, "Pull requests"),
    Signal("github.oldest_open_pr_days", "Oldest open PR", _days, "Pull requests"),
    Signal("github.median_pr_time_to_merge_seconds", "Median time to merge", _duration, "Pull requests"),
    Signal(CI_COLUMN, "Default-branch CI", _state, "Pull requests"),
    Signal(FIRST_TIMER_COLUMN, "First-timer PRs (90 days)", _count, "Newcomers"),
    Signal("github.first_timer_median_first_response_seconds", "Median first response", _duration, "Newcomers"),
    Signal("github.good_first_issues_open", "Good first issues open", _count, "Newcomers"),
)


def _present(value: Any) -> bool:
    return not pd.isna(value) and str(value).strip() != ""


def unmeasured_columns(df: pd.DataFrame) -> frozenset[str]:
    """Columns present but not really measured in this snapshot, to be hidden rather than shown as 0.

    First-timer PRs read 0 in every repo when the collecting token cannot see GitHub's
    newcomer associations (fixed upstream in edx-repo-health#724); an org of 169 repos
    with no newcomer at all is that failure, not a finding.
    """
    if FIRST_TIMER_COLUMN not in df.columns:
        return frozenset()
    counts = pd.to_numeric(df[FIRST_TIMER_COLUMN], errors="coerce").dropna()
    return NEWCOMER_COLUMNS if not counts.empty and counts.sum() == 0 else frozenset()


def repo_signals(row: pd.Series, skip: frozenset[str] = frozenset()) -> dict[str, list[tuple[str, str]]]:
    """Formatted signals for one repo, grouped, omitting columns it does not report or ``skip``."""
    grouped: dict[str, list[tuple[str, str]]] = {}
    for signal in SIGNALS:
        value = row.get(signal.column)
        if signal.column in row.index and signal.column not in skip and _present(value):
            grouped.setdefault(signal.group, []).append((signal.label, signal.formatter(value)))
    return grouped


def _column_sum(df: pd.DataFrame, column: str) -> int | None:
    if column not in df.columns:
        return None
    values = pd.to_numeric(df[column], errors="coerce").dropna()
    return int(values.sum()) if not values.empty else None


CI_FAILING_REPOS = "ci_failing_repos"
TOTAL_NOUNS = {
    "github.issues_open": "open issues",
    "github.prs_open": "open PRs",
    FIRST_TIMER_COLUMN: "first-timer PRs in 90 days",
    CI_FAILING_REPOS: "repos with failing default-branch CI",
}


def org_total_values(df: pd.DataFrame, skip: frozenset[str] = frozenset()) -> dict[str, int]:
    """Org-wide totals keyed by column, only for columns the snapshot carries and not in ``skip``."""
    totals = {}
    for column in ("github.issues_open", "github.prs_open", FIRST_TIMER_COLUMN):
        total = None if column in skip else _column_sum(df, column)
        if total is not None:
            totals[column] = total
    if CI_COLUMN in df.columns:
        totals[CI_FAILING_REPOS] = int(df[CI_COLUMN].astype(str).str.upper().isin(CI_FAILING_STATES).sum())
    return totals


def org_totals(df: pd.DataFrame, skip: frozenset[str] = frozenset()) -> list[str]:
    """Org-wide totals as short phrases, only for columns the snapshot carries and not in ``skip``."""
    return [f"{total:,} {TOTAL_NOUNS[key]}" for key, total in org_total_values(df, skip).items()]


def snapshot_has_signals(columns: list[str]) -> bool:
    return any(signal.column in columns for signal in SIGNALS)

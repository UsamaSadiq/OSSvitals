from __future__ import annotations

from datetime import date, timedelta
from typing import Any


LICENCE_MEMORY = ("present", "path", "sha", "spdx", "changed_on", "previous_spdx", "previous_present")


def row(record: dict[str, Any], day: str) -> dict[str, Any]:
    """Advisory counts and the licence state are kept only for tenants that collect them.

    The licence state lets a later run compare with the last known file when one run's lookup failed.
    """
    advisories = {"advisories_since_release": record["advisories"]["since_fork_release"]} if record.get("advisories") else {}
    watch = record.get("licence_watch")
    licence = {"licence": {key: watch[key] for key in LICENCE_MEMORY}} if watch else {}
    return {
        "date": day,
        "repo": record["repo"],
        "status": record["status"],
        "behind_by": record["behind_by"],
        "ahead_by": record["ahead_by"],
        **advisories,
        **licence,
    }


def last_licence(history: list[dict[str, Any]], repo: str) -> dict[str, Any] | None:
    known = [entry for entry in history if entry["repo"] == repo and entry.get("licence")]
    return max(known, key=lambda entry: entry["date"])["licence"] if known else None


def with_last_licence(previous: dict[str, dict[str, Any]], history: list[dict[str, Any]], repos: list[str]) -> dict[str, dict[str, Any]]:
    """Yesterday's record, with its licence state filled from history when yesterday's lookup failed or the fork errored."""
    filled = dict(previous)
    for repo in repos:
        if (previous.get(repo) or {}).get("licence_watch"):
            continue
        remembered = last_licence(history, repo)
        if remembered:
            filled[repo] = {**previous.get(repo, {}), "licence_watch": remembered}
    return filled


def append(previous: list[dict[str, Any]], drift: list[dict[str, Any]], day: str, keep_days: int) -> list[dict[str, Any]]:
    """Today's rows replace any earlier run of the same day; rows older than the window are dropped."""
    cutoff = (date.fromisoformat(day) - timedelta(days=keep_days)).isoformat()
    kept = [entry for entry in previous if entry["date"] != day and entry["date"] >= cutoff]
    today = [row(record, day) for record in drift if "error" not in record]
    return sorted(kept + today, key=lambda entry: (entry["date"], entry["repo"]))

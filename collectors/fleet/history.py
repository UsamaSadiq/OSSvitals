from __future__ import annotations

from datetime import date, timedelta
from typing import Any


def row(record: dict[str, Any], day: str) -> dict[str, Any]:
    """Advisory counts are kept only for tenants that collect advisories."""
    advisories = {"advisories_since_release": record["advisories"]["since_fork_release"]} if record.get("advisories") else {}
    return {
        "date": day,
        "repo": record["repo"],
        "status": record["status"],
        "behind_by": record["behind_by"],
        "ahead_by": record["ahead_by"],
        **advisories,
    }


def append(previous: list[dict[str, Any]], drift: list[dict[str, Any]], day: str, keep_days: int) -> list[dict[str, Any]]:
    """Today's rows replace any earlier run of the same day; rows older than the window are dropped."""
    cutoff = (date.fromisoformat(day) - timedelta(days=keep_days)).isoformat()
    kept = [entry for entry in previous if entry["date"] != day and entry["date"] >= cutoff]
    today = [row(record, day) for record in drift if "error" not in record]
    return sorted(kept + today, key=lambda entry: (entry["date"], entry["repo"]))

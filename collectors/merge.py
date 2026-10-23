"""Fold a repo-scoped collector run into the file the last full run published.

A partial run only re-collects the repos it was given, so the published file keeps
every other repo's record and the full run's ``generated_at``; ``refreshed_at`` and
``refreshed_repos`` record the partial run. Freshness checks keep reading
``generated_at``, so partial runs never hide a broken full run.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


def published(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def records(existing: list[dict[str, Any]], fresh: list[dict[str, Any]], refreshed: set[str]) -> list[dict[str, Any]]:
    """Existing records for repos outside ``refreshed``, plus the fresh ones."""
    kept = [record for record in existing if record["repo_name"] not in refreshed]
    return [*kept, *fresh]


def payload(
    existing: dict[str, Any], merged: list[dict[str, Any]], *, refreshed_at: datetime, refreshed: set[str], **fields: Any
) -> dict[str, Any]:
    """The full run's envelope around ``merged``, with ``fields`` recomputed and the partial run stamped."""
    return {
        "metadata": {
            **existing["metadata"],
            **fields,
            "refreshed_at": refreshed_at.isoformat(),
            "refreshed_repos": sorted(refreshed),
        },
        "records": merged,
    }

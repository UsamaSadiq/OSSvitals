"""Extension points a monolith offers at each named release: filters, events and frontend plugin slots.

Pure functions only; the GitHub reads live in ``scripts/collect_maintenance.py``.
"""
from __future__ import annotations

import re
from typing import Any

SOURCE = "Release tags of the platform, its extension packages and its frontend apps on GitHub"
VERSION = 1
CURRENT = "current"


def declaration_count(texts: list[str], pattern: str) -> int:
    return sum(len(re.findall(pattern, text)) for text in texts)


def matching_paths(paths: list[str], pattern: str) -> list[str]:
    return sorted(path for path in paths if re.search(pattern, path))


def slot_names(paths: list[str], roots: list[str]) -> set[str]:
    """Folder names directly under any of ``roots``; each folder is one plugin slot, counted once."""
    names = set()
    for root in roots:
        prefix = f"{root.rstrip('/')}/"
        names |= {path[len(prefix):].split("/", 1)[0] for path in paths if path.startswith(prefix) and "/" in path[len(prefix):]}
    return names


def package_record(version: str | None, count: int | None) -> dict[str, Any]:
    return {"version": version, "count": count}


def slots_record(per_repo: dict[str, int]) -> dict[str, Any]:
    shown = {repo: count for repo, count in sorted(per_repo.items()) if count}
    return {"total": sum(shown.values()), "repos": shown}


def is_reusable(row: dict[str, Any], published: dict[str, Any], config: dict[str, Any]) -> bool:
    """A named release's tags do not move, so its row stands while the code and settings that built it are unchanged."""
    return (
        row.get("release") != CURRENT
        and published.get("collector_version") == VERSION
        and published.get("settings") == config
    )


def summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Each count at the first release that has it, and now."""
    current = next((row for row in rows if row["release"] == CURRENT), None)
    releases = [row for row in rows if row["release"] != CURRENT]

    def first(pick) -> dict[str, Any] | None:
        row = next((row for row in releases if pick(row) is not None), None)
        return {"release": row["release"], "count": pick(row)} if row else None

    picks = {
        "filters": lambda row: row["filters"]["count"],
        "events": lambda row: row["events"]["count"],
        "plugin_slots": lambda row: row["plugin_slots"]["total"] or None,
    }
    return {
        name: {"first": first(pick), "now": pick(current) if current else None}
        for name, pick in picks.items()
    }

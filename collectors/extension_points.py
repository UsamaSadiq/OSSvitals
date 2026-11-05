"""Extension points a monolith offers at each named release: filters, events and frontend plugin slots.

Pure functions only; the GitHub reads live in ``scripts/collect_maintenance.py``.
"""
from __future__ import annotations

import re
from typing import Any

SOURCE = "Release tags of the platform, its extension packages and its frontend apps on GitHub"
VERSION = 2
CURRENT = "current"


def declaration_count(texts: list[str], pattern: str) -> int:
    return sum(len(re.findall(pattern, text)) for text in texts)


def matching_paths(paths: list[str], pattern: str) -> list[str]:
    return sorted(path for path in paths if re.search(pattern, path))


def _folders_under(path: str, prefix: str) -> list[str]:
    """Every folder between ``prefix`` and the file, as paths relative to ``prefix``."""
    parts = path[len(prefix):].split("/")[:-1]
    return ["/".join(parts[: depth + 1]) for depth in range(len(parts))]


def slot_folders(paths: list[str], roots: list[str], name_pattern: str) -> set[str]:
    """Folders at any depth under ``roots`` whose name matches ``name_pattern``.

    Some apps group slots in a plural folder (``CourseExitPluginSlots/``) and some nest a slot inside another, so
    only folders named like a slot count, wherever they sit.
    """
    found = set()
    for root in roots:
        prefix = f"{root.rstrip('/')}/"
        for path in paths:
            if path.startswith(prefix):
                found |= {f"{root}:{folder}" for folder in _folders_under(path, prefix) if re.search(name_pattern, folder.rsplit("/", 1)[-1])}
    return found


def package_record(version: str | None, count: int | None) -> dict[str, Any]:
    return {"version": version, "count": count}


def slots_record(per_repo: dict[str, int]) -> dict[str, Any]:
    shown = {repo: count for repo, count in sorted(per_repo.items()) if count}
    return {"total": sum(shown.values()), "repos": shown}


def is_complete(row: dict[str, Any]) -> bool:
    """A pinned package whose declarations could not be counted means the row is missing data."""
    return all(not (row[name]["version"] and row[name]["count"] is None) for name in ("filters", "events"))


def is_reusable(row: dict[str, Any], published: dict[str, Any], config: dict[str, Any], *, newest: str | None) -> bool:
    """A named release's tags do not move, so its row stands while the code and settings that built it are unchanged.

    The newest release is read again every day: its frontend repos may be tagged after the platform.
    """
    return (
        row.get("release") not in (CURRENT, newest)
        and is_complete(row)
        and published.get("collector_version") == VERSION
        and published.get("settings") == config
    )


def summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Each count at the first release that has it, and now."""
    current = next((row for row in rows if row["release"] == CURRENT), None)
    releases = [row for row in rows if row["release"] != CURRENT]
    picks = {
        "filters": lambda row: row["filters"]["count"],
        "events": lambda row: row["events"]["count"],
        "plugin_slots": lambda row: row["plugin_slots"]["total"],
    }

    def first(pick) -> dict[str, Any] | None:
        row = next((row for row in releases if pick(row)), None)
        return {"release": row["release"], "count": pick(row)} if row else None

    return {name: {"first": first(pick), "now": pick(current) if current else None} for name, pick in picks.items()}

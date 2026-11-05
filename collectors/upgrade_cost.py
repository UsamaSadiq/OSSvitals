"""Upgrade cost of each named release: deprecations that land in it, breaking changes, and time since the last one.

Pure functions only; the GitHub reads live in ``scripts/collect_maintenance.py``.
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any

SOURCE = "DEPR tickets, release notes and release tags of the platform on GitHub"
VERSION = 1
UNDERLINE = re.compile(r"^([*=\-~^#])\1{2,}\s*$")
TOP_LEVEL_BULLET = re.compile(r"^[*-]\s+\S")


def field_value(body: str | None, field_pattern: str) -> str | None:
    """The first non-empty line under the first issue-form heading that matches ``field_pattern``."""
    lines = (body or "").splitlines()
    for index, line in enumerate(lines):
        if line.startswith("### ") and re.search(field_pattern, line[4:]):
            return next((value.strip() for value in lines[index + 1:] if value.strip() and not value.startswith("### ")), None)
    return None


def release_named(value: str | None, names: list[str]) -> str | None:
    """The release a free-text value starts with: its name ("ulmo - 2025-10") or its initial ("q - 2023-10")."""
    text = (value or "").strip().lower()
    word = re.match(r"([a-z]+)", text)
    if word and word.group(1) in names:
        return word.group(1)
    initial = re.match(r"([a-z])\s*(-|$)", text)
    matches = [name for name in names if initial and name.startswith(initial.group(1))]
    return matches[0] if len(matches) == 1 else None


def is_heading(lines: list[str], index: int) -> bool:
    return index + 1 < len(lines) and bool(lines[index].strip()) and bool(UNDERLINE.match(lines[index + 1]))


def section_items(rst: str | None, heading: str) -> int | None:
    """Top-level bullets in the reStructuredText section titled ``heading``; None when there is no such section."""
    lines = (rst or "").splitlines()
    start = next((index for index in range(len(lines)) if lines[index].strip() == heading and is_heading(lines, index)), None)
    if start is None:
        return None
    count = 0
    for index in range(start + 2, len(lines)):
        if is_heading(lines, index):
            break
        count += bool(TOP_LEVEL_BULLET.match(lines[index]))
    return count


def deprecation_counts(tickets: list[dict[str, Any]]) -> dict[str, int]:
    open_count = sum(1 for ticket in tickets if ticket["state"] == "open")
    return {"total": len(tickets), "open": open_count, "closed": len(tickets) - open_count}


def by_release(tickets: list[dict[str, Any]], names: list[str], field_pattern: str) -> dict[str | None, list[dict[str, Any]]]:
    """Tickets grouped by the release they name; ``None`` holds the ones that name none (blank, "TBD", prose)."""
    grouped: dict[str | None, list[dict[str, Any]]] = {}
    for ticket in tickets:
        release = release_named(field_value(ticket.get("body"), field_pattern), names)
        grouped.setdefault(release, []).append(ticket)
    return grouped


def days_between(earlier: date | None, later: date | None) -> int | None:
    return (later - earlier).days if earlier and later else None


def release_rows(
    releases: list[tuple[str, date | None]],
    grouped: dict[str | None, list[dict[str, Any]]],
    breaking: dict[str, int | None],
) -> list[dict[str, Any]]:
    """One row per release in order; a release not cut yet has no date."""
    rows = []
    previous: date | None = None
    for name, released in releases:
        rows.append({
            "release": name,
            "date": released.isoformat() if released else None,
            "days_since_previous": days_between(previous, released),
            "deprecations": deprecation_counts(grouped.get(name, [])),
            "breaking_changes": breaking.get(name),
        })
        previous = released or previous
    return rows


def summary(rows: list[dict[str, Any]], unscheduled: dict[str, int]) -> dict[str, Any]:
    cut = [row for row in rows if row["date"]]
    gaps = [row["days_since_previous"] for row in cut if row["days_since_previous"] is not None]
    return {
        "releases": len(cut),
        "median_days_between": sorted(gaps)[len(gaps) // 2] if gaps else None,
        "deprecations": sum(row["deprecations"]["total"] for row in rows),
        "open_deprecations": sum(row["deprecations"]["open"] for row in rows) + unscheduled["open"],
        "unscheduled": unscheduled,
    }

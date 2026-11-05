"""Upgrade cost of each named release: deprecations that land in it, breaking changes, and time since the last one.

Pure functions only; the GitHub reads live in ``scripts/collect_maintenance.py``.
"""
from __future__ import annotations

import re
import statistics
from datetime import date
from typing import Any

SOURCE = "DEPR tickets, release notes and release tags of the platform on GitHub"
VERSION = 1
WITHDRAWN = "not_planned"
UNDERLINE = re.compile(r"^([*=\-~^#+`:.'\"_])\1{2,}\s*$")
TOP_LEVEL_ITEM = re.compile(r"^([*+-]|\d+\.|#\.)\s+\S")
MARKUP = "*_` "


def field_value(body: str | None, field_pattern: str) -> str | None:
    """The first non-blank line of the first issue-form field whose heading matches; None when that field is empty."""
    lines = (body or "").splitlines()
    for index, line in enumerate(lines):
        if line.startswith("### ") and re.search(field_pattern, line[4:].strip()):
            for value in lines[index + 1:]:
                if value.startswith("### "):
                    return None
                if value.strip():
                    return value.strip()
            return None
    return None


def release_named(value: str | None, names: list[str]) -> str | None:
    """The release a free-text value starts with: its name ("**Ulmo** - 2025-10") or its initial and a date ("Q - 2023-10")."""
    text = (value or "").strip().lower().lstrip(MARKUP)
    word = re.match(r"([a-z]+)", text)
    if word and word.group(1) in names:
        return word.group(1)
    initial = re.match(r"([a-z])[*_`]*\s*-\s*\d{4}", text)
    matches = [name for name in names if initial and name.startswith(initial.group(1))]
    return matches[0] if len(matches) == 1 else None


def headings(lines: list[str]) -> list[tuple[int, int]]:
    """(line index, level) of each reStructuredText section title; levels follow the order styles first appear."""
    styles: list[tuple[str, bool]] = []
    found = []
    for index in range(len(lines) - 1):
        title, under = lines[index].strip(), lines[index + 1].strip()
        if not title or UNDERLINE.match(lines[index]) or not UNDERLINE.match(lines[index + 1]) or len(under) < len(title):
            continue
        style = (under[0], index > 0 and lines[index - 1].strip() == under)
        if style not in styles:
            styles.append(style)
        found.append((index, styles.index(style)))
    return found


def section_items(rst: str | None, heading: str) -> int | None:
    """Changes listed in the section titled ``heading``: its sub-sections if it has any, else its top-level list items.

    None when there is no such section. Older release notes give each breaking change a sub-section, newer ones a
    bullet, so both count as one change.
    """
    lines = (rst or "").splitlines()
    titles = headings(lines)
    start = next(((index, level) for index, level in titles if lines[index].strip() == heading), None)
    if start is None:
        return None
    index, level = start
    end = next((other for other, other_level in titles if other > index and other_level <= level), len(lines))
    children = [other_level for other, other_level in titles if index < other < end]
    if children:
        return children.count(min(children))
    return sum(1 for line in lines[index + 2:end] if TOP_LEVEL_ITEM.match(line))


def is_withdrawn(ticket: dict[str, Any]) -> bool:
    return ticket.get("state_reason") == WITHDRAWN


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
    previous: date | None = None,
) -> list[dict[str, Any]]:
    """One row per release in order; a release not cut yet has no date. ``previous`` is the release before the first row."""
    rows = []
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


def summary(rows: list[dict[str, Any]], buckets: dict[str, dict[str, int]]) -> dict[str, Any]:
    gaps = [row["days_since_previous"] for row in rows if row["days_since_previous"] is not None]
    return {
        "releases": sum(1 for row in rows if row["date"]),
        "median_days_between": statistics.median_low(gaps) if gaps else None,
        "deprecations": sum(row["deprecations"]["total"] for row in rows),
        "open_deprecations": sum(row["deprecations"]["open"] for row in rows)
        + buckets["unscheduled"]["open"]
        + buckets["earlier"]["open"],
    }

"""Support windows: release cycles from endoflife.date, what Tutor ships, what OEP-10 declares.

Pure functions only; the network calls live in ``scripts/collect_maintenance.py``.
"""
from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from datetime import date
from typing import Any

SOURCE = "endoflife.date release cycles; Tutor release files; repo-tools barcalendar.py CURRENT, release names and years"
EOL_API = "https://endoflife.date/api/{slug}.json"
EOL_PAGE = "https://endoflife.date/{slug}"

DRIFT = "drift"
EOL = "eol"
EOL_SOON = "eol_soon"
OK = "ok"
UNKNOWN = "unknown"
STATUSES = (DRIFT, EOL, EOL_SOON, OK, UNKNOWN)

DECLARED = "declared"
FOLLOWS_TUTOR = "follows_tutor"
MISSING = "missing"

NEWER_CYCLES_SHOWN = 3
OPEN_EDX_RELEASE_MONTHS = 6
MAJOR_CYCLE = re.compile(r"^\d+(\.0)?$")

Cycle = dict[str, Any]


@dataclass(frozen=True)
class Declared:
    kind: str
    version: str | None = None


@dataclass(frozen=True)
class Detected:
    version: str | None
    repo: str
    ref: str | None
    path: str

    @property
    def url(self) -> str | None:
        return f"https://github.com/{self.repo}/blob/{self.ref}/{self.path}" if self.ref else None


def month_date(text: str) -> date:
    """``YYYY-MM`` or ``YYYY-MM-DD`` as a date; a bare month is its first day."""
    year, month, *day = (int(part) for part in str(text).split("-"))
    return date(year, month, day[0] if day else 1)


def add_months(day: date, months: int) -> date:
    year, month = divmod(day.month - 1 + months, 12)
    return date(day.year + year, month + 1, 1)


def detect(text: str | None, pattern: str) -> str | None:
    match = re.search(pattern, text) if text else None
    return match.group(1) if match else None


def declared_versions(source: str | None) -> dict[str, Declared]:
    """The ``CURRENT`` dict of barcalendar.py; values it computes from Tutor never drift."""
    if not source:
        return {}
    for node in ast.walk(ast.parse(source)):
        if _assigns(node, "CURRENT", ast.Dict):
            return {
                key.value: _declared(value)
                for key, value in zip(node.value.keys, node.value.values)
                if isinstance(key, ast.Constant) and isinstance(key.value, str)
            }
    return {}


def release_schedule(source: str | None) -> list[tuple[str, date]]:
    """The ``names`` list of barcalendar.py: each Open edX release and the month OEP-10 schedules it for."""
    if not source:
        return []
    for node in ast.walk(ast.parse(source)):
        if _assigns(node, "names", ast.List):
            return [entry for entry in map(_scheduled, node.value.elts) if entry]
    return []


def calendar_years(source: str | None) -> tuple[int, int] | None:
    """``START_YEAR`` and ``END_YEAR`` of barcalendar.py, the first and last year the OEP-10 sheet draws."""
    if not source:
        return None
    years = {
        target.id: node.value.value
        for node in ast.parse(source).body
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, int)
        for target in node.targets
        if isinstance(target, ast.Name) and target.id in ("START_YEAR", "END_YEAR")
    }
    start, end = years.get("START_YEAR"), years.get("END_YEAR")
    return (start, end) if start is not None and end is not None and start <= end else None


def calendar_window(years: tuple[int, int] | None, today: date, fallback: dict[str, int]) -> dict[str, int]:
    """The chart window as years back and ahead of ``today``, matching the sheet when its years are known."""
    if years is None:
        return fallback
    start, end = years
    return {"years_back": max(today.year - start, 0), "years_ahead": max(end - today.year, 0)}


def release_starts(
    tagged: dict[str, date], schedule: list[tuple[str, date]], planned: list[dict[str, Any]]
) -> dict[str, date]:
    """When each release starts: a configured month, else the OEP-10 scheduled month, else its .1 tag."""
    starts = {name.capitalize(): day for name, day in tagged.items()}
    starts.update(schedule)
    starts.update({entry["name"].capitalize(): month_date(entry["date"]) for entry in planned})
    return starts


def _assigns(node: ast.AST, name: str, kind: type[ast.expr]) -> bool:
    return (
        isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == name for target in node.targets)
        and isinstance(node.value, kind)
    )


def _scheduled(node: ast.expr) -> tuple[str, date] | None:
    if not isinstance(node, ast.Tuple) or len(node.elts) != 3:
        return None
    name, year, month = (elt.value if isinstance(elt, ast.Constant) else None for elt in node.elts)
    if not (isinstance(name, str) and isinstance(year, int) and isinstance(month, int) and 1 <= month <= 12):
        return None
    return name.capitalize(), date(year, month, 1)


def _declared(value: ast.expr | None) -> Declared:
    if isinstance(value, ast.Constant) and isinstance(value.value, str):
        return Declared(DECLARED, value.value)
    return Declared(FOLLOWS_TUTOR)


def _is_lts(row: dict[str, Any]) -> bool:
    return bool(row.get("lts"))


def _major(cycle: str) -> str:
    return cycle.split(".", 1)[0]


def _keep(rows: list[dict[str, Any]], rule: str) -> list[dict[str, Any]]:
    if rule == "lts":
        return [row for row in rows if _is_lts(row)]
    if rule == "major":
        return [row for row in rows if MAJOR_CYCLE.match(str(row["cycle"]))]
    if rule == "latest_minor_per_major":
        newest: dict[str, dict[str, Any]] = {}
        for row in sorted(rows, key=lambda row: row["releaseDate"]):
            newest[_major(str(row["cycle"]))] = row
        return list(newest.values())
    return rows


def _cycle(row: dict[str, Any]) -> Cycle:
    end = row.get("eol")
    return {
        "cycle": str(row["cycle"]),
        "start": row["releaseDate"],
        "end": end if isinstance(end, str) else None,
        "lts": _is_lts(row),
    }


def _extra(entry: dict[str, Any]) -> Cycle:
    end = entry.get("end")
    return {
        "cycle": str(entry["cycle"]),
        "start": month_date(entry["start"]).isoformat(),
        "end": month_date(end).isoformat() if end else None,
        "lts": False,
    }


def cycles_from_endoflife(rows: list[dict[str, Any]], rule: str = "all", extra: list[dict[str, Any]] | None = None) -> list[Cycle]:
    """Release cycles oldest first, filtered by ``rule``; ``extra`` fills cycles endoflife.date lacks."""
    added = [_extra(entry) for entry in extra or []]
    replaced = {_replaced_key(cycle["cycle"], rule) for cycle in added}
    fetched = [
        _cycle(row)
        for row in _keep([row for row in rows if row.get("releaseDate")], rule)
        if _replaced_key(str(row["cycle"]), rule) not in replaced
    ]
    return sorted(fetched + added, key=lambda cycle: cycle["start"])


def _replaced_key(cycle: str, rule: str) -> str:
    """A configured cycle stands in for the fetched one it shares this key with."""
    return _major(cycle) if rule == "latest_minor_per_major" else cycle


def _still_supported(cycle: Cycle, today: date) -> bool:
    return cycle["end"] is None or month_date(cycle["end"]) >= today


def shown_cycles(cycles: list[Cycle], current: str | None, today: date) -> list[Cycle]:
    """The cycle before ``current``, ``current`` itself and the next few, each marked current or not."""
    names = [cycle["cycle"] for cycle in cycles]
    if current in names:
        at = names.index(current)
        picked = cycles[max(at - 1, 0): at + 1 + NEWER_CYCLES_SHOWN]
    else:
        picked = [cycle for cycle in cycles if _still_supported(cycle, today)][-(NEWER_CYCLES_SHOWN + 1):]
    return marked_current(picked, current)


def marked_current(cycles: list[Cycle], current: str | None) -> list[Cycle]:
    return [{**cycle, "current": cycle["cycle"] == current} for cycle in cycles]


def open_edx_cycles(starts: dict[str, date]) -> list[Cycle]:
    """Named releases oldest first; each runs until the next one, the last for one release length."""
    ordered = sorted(starts.items(), key=lambda item: item[1])
    if not ordered:
        return []
    ends = [start for _, start in ordered[1:]] + [add_months(ordered[-1][1], OPEN_EDX_RELEASE_MONTHS)]
    return [
        {"cycle": name, "start": start.isoformat(), "end": end.isoformat(), "lts": False}
        for (name, start), end in zip(ordered, ends)
    ]


def _end_of(cycles: list[Cycle], version: str | None) -> date | None:
    end = next((cycle["end"] for cycle in cycles if cycle["cycle"] == version), None)
    return month_date(end) if end else None


def status(
    declared: Declared,
    detected: Detected,
    current_end: date | None,
    today: date,
    eol_soon_months: int,
    *,
    tracks_eol: bool = True,
) -> tuple[str, str]:
    """Worst state first: unreadable source, then drift, then past or near end of life."""
    if detected.version is None:
        return UNKNOWN, f"Could not read the version from {detected.repo} {detected.path}"
    if declared.kind == DECLARED and declared.version != detected.version:
        return DRIFT, f"barcalendar.py declares {declared.version}; {detected.repo} {detected.ref} ships {detected.version}"
    if not tracks_eol:
        return OK, ""
    if current_end and current_end < today:
        return EOL, f"{detected.version} reached end of life in {current_end:%B %Y}"
    if current_end and current_end < add_months(today, eol_soon_months):
        return EOL_SOON, f"{detected.version} reaches end of life in {current_end:%B %Y}"
    return OK, ""


def product_record(
    product: str,
    settings: dict[str, Any],
    cycles: list[Cycle],
    declared: Declared,
    detected: Detected,
    *,
    today: date,
    eol_soon_months: int,
    tracks_eol: bool = True,
    every_cycle: bool = False,
) -> dict[str, Any]:
    """``tracks_eol`` is off for Open edX, whose release simply runs until the next one; ``every_cycle`` keeps all its releases."""
    current = detected.version or declared.version
    current_end = _end_of(cycles, current)
    state, reason = status(declared, detected, current_end, today, eol_soon_months, tracks_eol=tracks_eol)
    return {
        "product": product,
        "label": settings["label"],
        "source_note": settings.get("source_note") or EOL_PAGE.format(slug=settings.get("eol_slug", product)),
        "declared": declared.version,
        "declared_kind": declared.kind,
        "detected": detected.version,
        "detected_url": detected.url,
        "current": current,
        "current_end": current_end.isoformat() if current_end else None,
        "status": state,
        "reason": reason,
        "cycles": marked_current(cycles, current) if every_cycle else shown_cycles(cycles, current, today),
    }


def summary(records: list[dict[str, Any]]) -> dict[str, int]:
    return {state: sum(record["status"] == state for record in records) for state in STATUSES}

"""Is the published data recent? Used by the data-freshness workflow.

Each source reports the date it describes: the upstream CSV's TIMESTAMP, and the
``metadata`` of the files this project publishes. A source is stale when that date
is older than the limit, or when it cannot be read at all.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime


@dataclass(frozen=True)
class SourceStatus:
    name: str
    url: str
    as_of: date | None
    age_days: int | None
    stale: bool
    detail: str = ""


def to_date(value: object) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            return None


def status(name: str, url: str, as_of: date | None, *, today: date, max_age_days: int, detail: str = "") -> SourceStatus:
    if as_of is None:
        return SourceStatus(name, url, None, None, True, detail or "could not read a date")
    age = (today - as_of).days
    return SourceStatus(name, url, as_of, age, age > max_age_days, detail)


def report(statuses: list[SourceStatus], *, max_age_days: int) -> str:
    lines = [
        f"Data freshness check (limit: {max_age_days} days).",
        "",
        "| Source | As of | Age (days) | State |",
        "|---|---|---|---|",
    ]
    for item in statuses:
        state = "stale" if item.stale else "ok"
        as_of = item.as_of.isoformat() if item.as_of else "unreadable"
        age = "" if item.age_days is None else str(item.age_days)
        note = f" ({item.detail})" if item.detail else ""
        lines.append(f"| [{item.name}]({item.url}) | {as_of} | {age} | {state}{note} |")
    return "\n".join(lines) + "\n"

"""How concentrated upstream's work is and how often it releases. Shown, never scored: a small project with one
maintainer is not unhealthy by itself, and release recency alone is a weak sign of abandonment."""
from __future__ import annotations

from datetime import datetime, timedelta
from statistics import median
from typing import Any

from collectors.fleet.context import ForkContext
from collectors.fleet.signals import Signal, guarded

WINDOW = timedelta(days=365)


def _is_bot(author: dict[str, Any] | None) -> bool:
    login = (author or {}).get("login") or ""
    return not login or login.endswith("[bot]") or (author or {}).get("type") == "Bot"


def contributors(stats: list[dict[str, Any]], now: datetime) -> dict[str, Any]:
    """From GitHub's weekly contributor counts (default branch): commits in the last year, people behind them, and
    the fewest people who made half of them."""
    cutoff = (now - WINDOW).timestamp()
    per_person = {
        entry["author"]["login"]: sum(week["c"] for week in entry.get("weeks", []) if week["w"] >= cutoff)
        for entry in stats
        if not _is_bot(entry.get("author"))
    }
    counts = sorted((count for count in per_person.values() if count > 0), reverse=True)
    total = sum(counts)
    half, running, people = total / 2, 0, 0
    for count in counts:
        if running >= half:
            break
        running, people = running + count, people + 1
    return {
        "commits": total,
        "people": len(counts),
        "half_of_commits_by": people if total else None,
        "top_share": round(counts[0] / total, 3) if total else None,
    }


def _published(release: dict[str, Any]) -> datetime:
    return datetime.fromisoformat(release["published_at"].replace("Z", "+00:00"))


def releases(upstream_releases: list[dict[str, Any]], now: datetime) -> dict[str, Any]:
    """Stable releases in the last year, days since the newest, and the median gap between them."""
    dates = sorted((_published(release) for release in upstream_releases), reverse=True)
    recent = [day for day in dates if now - day <= WINDOW]
    gaps = [(newer - older).days for newer, older in zip(recent, recent[1:])]
    return {
        "last_year": len(recent),
        "days_since_latest": (now - dates[0]).days if dates else None,
        "median_gap_days": round(median(gaps)) if gaps else None,
    }


def health(stats: Any, upstream_releases: list[dict[str, Any]], now: datetime) -> dict[str, Any]:
    """GitHub can answer 202 while it computes contributor counts; those then show as unknown for the day."""
    return {
        "contributors": contributors(stats, now) if isinstance(stats, list) else None,
        "releases": releases(upstream_releases, now),
    }


def collect(ctx: ForkContext) -> dict[str, Any]:
    return {"upstream_health": guarded(lambda: health(ctx.api(f"repos/{ctx.upstream}/stats/contributors"), ctx.upstream_releases, ctx.now))}


SIGNAL = Signal("upstream_health", collect)

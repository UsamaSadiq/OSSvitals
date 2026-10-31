"""How concentrated upstream's work is and how often it releases. Shown, never scored: a small project with one
maintainer is not unhealthy by itself, and release recency alone is a weak sign of abandonment."""
from __future__ import annotations

import time
from datetime import datetime, timedelta
from fnmatch import fnmatch
from statistics import median
from typing import Any, Callable

from collectors.fleet.context import ForkContext
from collectors.fleet.signals import Signal, guarded

WINDOW = timedelta(days=365)
WEEK_SECONDS = 7 * 24 * 3600
# GitHub caps the list: some repositories come back with exactly this many authors, ranked by all-time commits.
AUTHOR_CAP = 100
STATS_ATTEMPTS = 3
STATS_WAIT_SECONDS = 5
# Accounts GitHub types as users but that are agents or automation.
AUTOMATION = ("*-bot", "*-translations", "claude", "cursoragent", "copilot", "copilot-swe-agent", "github-actions", "weblate", "renovate", "dependabot")


def is_automation(author: dict[str, Any] | None, extra: list[str]) -> bool:
    login = ((author or {}).get("login") or "").lower()
    if not login or login.endswith("[bot]") or (author or {}).get("type") == "Bot":
        return True
    return any(fnmatch(login, pattern.lower()) for pattern in (*AUTOMATION, *extra))


def contributors(stats: list[dict[str, Any]], now: datetime, exclude: list[str] = ()) -> dict[str, Any]:
    """From GitHub's weekly counts for the default branch: commits by people in the last year, how many people, the
    fewest who made half of them, and the top person's share. Weeks overlapping the window count in full."""
    cutoff = (now - WINDOW).timestamp()

    def recent(entry: dict[str, Any]) -> int:
        return sum(week["c"] for week in entry.get("weeks", []) if week["w"] + WEEK_SECONDS > cutoff)

    people = [recent(entry) for entry in stats if not is_automation(entry.get("author"), list(exclude))]
    automated = sum(recent(entry) for entry in stats if is_automation(entry.get("author"), list(exclude)))
    counts = sorted((count for count in people if count > 0), reverse=True)
    total = sum(counts)
    half, running, needed = total / 2, 0, 0
    for count in counts:
        if running >= half:
            break
        running, needed = running + count, needed + 1
    return {
        "commits": total,
        "automated_commits": automated,
        "people": len(counts),
        "half_of_commits_by": needed if total else None,
        "top_share": round(counts[0] / total, 3) if total else None,
        "truncated": len(stats) == AUTHOR_CAP,
        "as_of": now.date().isoformat(),
    }


def fetch_stats(api: Callable[[str], Any], upstream: str, sleep: Callable[[float], None] = time.sleep) -> list[dict[str, Any]] | None:
    """GitHub answers 202 with an empty body while it computes the counts, and recomputes after every push."""
    for attempt in range(STATS_ATTEMPTS):
        stats = api(f"repos/{upstream}/stats/contributors")
        if isinstance(stats, list):
            return stats
        if attempt < STATS_ATTEMPTS - 1:
            sleep(STATS_WAIT_SECONDS * (attempt + 1))
    return None


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


def health(
    stats: list[dict[str, Any]] | None,
    previous: dict[str, Any] | None,
    upstream_releases: list[dict[str, Any]],
    upstream_repo: dict[str, Any] | None,
    tracked_branch: str,
    now: datetime,
    exclude: list[str] = (),
) -> dict[str, Any]:
    """Counts still being computed fall back to the last ones we had, which keep their date."""
    remembered = ((previous or {}).get("contributors")) or None
    default_branch = (upstream_repo or {}).get("default_branch")
    return {
        "contributors": contributors(stats, now, exclude) if stats is not None else remembered,
        "releases": releases(upstream_releases, now),
        "default_branch": default_branch,
        "tracks_default_branch": default_branch == tracked_branch if default_branch else None,
    }


def collect(ctx: ForkContext) -> dict[str, Any]:
    exclude = ctx.settings.signal("upstream_health")["exclude_logins"]
    previous = (ctx.previous or {}).get("upstream_health")

    def observe() -> dict[str, Any]:
        stats = fetch_stats(ctx.api, ctx.upstream)
        return health(stats, previous, ctx.upstream_releases, ctx.upstream_repo, ctx.app["upstream_branch"], ctx.now, exclude)

    return {"upstream_health": guarded(observe)}


SIGNAL = Signal("upstream_health", collect)

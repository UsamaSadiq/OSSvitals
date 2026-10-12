from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Callable

from collectors.moneta import signals
from collectors.moneta.status import classify

Api = Callable[[str], Any]
MergedBy = Callable[[str, str, str], list[str] | None]

STABLE_TAG = re.compile(r"^v?\d+(\.\d+)+$")
RC_TAG = re.compile(r"^v?(\d+(?:\.\d+)+)-rc[.\-]?(\d*)$")
TAG_CANDIDATES = 5
ADVISORY_SOURCE = "github-published-advisories"
ADVISORY_ITEMS = 10


def version_key(tag: str) -> tuple[int, ...]:
    return tuple(int(part) for part in tag.lstrip("v").split("."))


def stable_tags(tags: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stable = [tag for tag in tags if STABLE_TAG.match(tag["name"])]
    return sorted(stable, key=lambda tag: version_key(tag["name"]), reverse=True)


def rc_tags(tags: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def order(tag: dict[str, Any]) -> tuple[tuple[int, ...], int]:
        match = RC_TAG.match(tag["name"])
        return version_key(match.group(1)), int(match.group(2) or 0)

    return sorted((tag for tag in tags if RC_TAG.match(tag["name"])), key=order, reverse=True)


def _commit_date(commit: dict[str, Any]) -> str:
    return commit["commit"]["committer"]["date"]


def _is_fork_only(api: Api, base: str, upstream_ref: str, sha: str) -> bool:
    comparison = api(f"{base}/compare/{upstream_ref}...{sha}")
    return bool(comparison) and comparison["ahead_by"] > 0


def latest_fork_release(api: Api, base: str, upstream_ref: str, tags: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Newest stable tag whose commit is not in upstream; tags inherited from upstream are skipped."""
    for tag in stable_tags(tags)[:TAG_CANDIDATES]:
        sha = tag["commit"]["sha"]
        if _is_fork_only(api, base, upstream_ref, sha):
            commit = api(f"{base}/commits/{sha}")
            return {"tag": tag["name"], "date": _commit_date(commit) if commit else None}
    return None


def pending_release_candidate(api: Api, base: str, upstream_ref: str, tags: list[dict[str, Any]], release: dict[str, Any] | None) -> dict[str, Any] | None:
    """Newest fork-only release candidate that is newer than our latest stable release."""
    floor = version_key(release["tag"]) if release else ()
    newer = [tag for tag in rc_tags(tags) if version_key(RC_TAG.match(tag["name"]).group(1)) > floor]
    for tag in newer[:TAG_CANDIDATES]:
        if _is_fork_only(api, base, upstream_ref, tag["commit"]["sha"]):
            return {"tag": tag["name"]}
    return None


def upstream_releases(api: Api, upstream: str) -> list[dict[str, Any]]:
    releases = api(f"repos/{upstream}/releases?per_page=100") or []
    return [release for release in releases if not release["draft"] and not release["prerelease"]]


def latest_upstream_release(api: Api, upstream: str, releases: list[dict[str, Any]]) -> dict[str, Any] | None:
    if releases:
        return {"tag": releases[0]["tag_name"], "date": releases[0]["published_at"]}
    tags = stable_tags(api(f"repos/{upstream}/tags?per_page=100") or [])
    return {"tag": tags[0]["name"], "date": None} if tags else None


def release_lag(releases: list[dict[str, Any]], merged_at: str, fork_release: dict[str, Any] | None) -> dict[str, Any]:
    since = [release for release in releases if release["published_at"] > merged_at]
    ours = fork_release["date"] if fork_release else None
    latest = releases[0]["published_at"] if releases else None
    behind_days = _days_between(ours, latest) if ours and latest and latest > ours else None
    return {"upstream_releases_since_sync": len(since), "upstream_ahead_of_our_release_days": behind_days}


def advisory_summary(api: Api, upstream: str, since: str | None, severe: list[str]) -> dict[str, Any]:
    published = api(f"repos/{upstream}/security-advisories?per_page=100") or []
    items = [
        {
            "ghsa_id": advisory.get("ghsa_id"),
            "severity": advisory.get("severity"),
            "summary": advisory.get("summary"),
            "url": advisory.get("html_url"),
            "published_at": advisory["published_at"],
            "after_our_release": since is not None and advisory["published_at"] > since,
        }
        for advisory in sorted(published, key=lambda advisory: advisory["published_at"], reverse=True)
    ]
    newer = [item for item in items if item["after_our_release"]]
    return {
        "published": len(items),
        "since_fork_release": len(newer),
        "severe_since_fork_release": sum(1 for item in newer if item["severity"] in severe),
        "source": ADVISORY_SOURCE,
        "items": items[:ADVISORY_ITEMS],
    }


def promotion(api: Api, base: str, production: str, staging: str | None) -> dict[str, Any] | None:
    if staging is None:
        return None
    comparison = api(f"{base}/compare/{production}...{staging}")
    return {"unpromoted_commits": comparison["ahead_by"]} if comparison else None


def _parse(iso_date: str) -> datetime:
    return datetime.fromisoformat(iso_date.replace("Z", "+00:00"))


def _days_between(earlier: str, later: str) -> int:
    return (_parse(later) - _parse(earlier)).days


def _days_since(iso_date: str, now: datetime) -> int:
    return (now - _parse(iso_date)).days


def collect_fork(
    api: Api,
    org: str,
    app: dict[str, Any],
    rules: dict[str, Any],
    now: datetime,
    merged_by: MergedBy = lambda *_: None,
) -> dict[str, Any]:
    base = f"repos/{org}/{app['repo']}"
    owner = app["upstream"].split("/")[0]
    production = app.get("production_branch", rules["branches"]["production"])
    staging = None if "production_branch" in app else rules["branches"]["staging"]
    upstream_ref = f"{owner}:{app['upstream_branch']}"
    comparison = api(f"{base}/compare/{upstream_ref}...{production}")
    if comparison is None:
        raise LookupError(f"cannot compare {upstream_ref} with {production}")
    merged_at = comparison["merge_base_commit"]["commit"]["committer"]["date"]
    tags = api(f"{base}/tags?per_page=100") or []
    release = latest_fork_release(api, base, upstream_ref, tags)
    releases = upstream_releases(api, app["upstream"])
    advisories = advisory_summary(api, app["upstream"], release["date"] if release else None, rules.get("critical_advisory_severities", []))
    days = _days_since(merged_at, now)
    return {
        "repo": app["repo"],
        "production_branch": production,
        "ahead_by": comparison["ahead_by"],
        "behind_by": comparison["behind_by"],
        "last_upstream_merge": merged_at,
        "days_since_upstream_merge": days,
        "fork_release": release,
        "release_candidate": pending_release_candidate(api, base, upstream_ref, tags, release),
        "upstream_release": latest_upstream_release(api, app["upstream"], releases),
        "release_lag": release_lag(releases, merged_at, release),
        "advisories": advisories,
        "promotion": promotion(api, base, production, staging),
        "ci": signals.guarded(lambda: signals.ci_status(api, base, production)),
        "pull_requests": signals.guarded(lambda: signals.open_pull_requests(api, base, production)),
        "maintainers": signals.guarded(lambda: signals.merged_by(merged_by, org, app["repo"], production)),
        "upstream_activity": signals.guarded(lambda: signals.upstream_activity(api, app["upstream"], now, rules.get("upstream_quiet_days", 120))),
        "status": classify(rules["statuses"], comparison["behind_by"], days, advisories["severe_since_fork_release"] > 0),
    }

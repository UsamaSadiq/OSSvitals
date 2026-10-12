from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Callable

from urllib.parse import quote

from collectors.moneta import signals
from collectors.moneta.ranges import affects, version_key
from collectors.moneta.status import classify

Api = Callable[[str], Any]
MergedBy = Callable[[str, str, str], list[str] | None]

STABLE_TAG = re.compile(r"^v?\d+(\.\d+)+$")
FORK_RELEASE_TAG = r"^v2\d\.\d{1,2}\.\d+$"
RC_TAG = re.compile(r"^v?(\d+(?:\.\d+)+)-rc[.\-]?(\d*)$")
RC_SUFFIX = re.compile(r"-rc[.\-]?\d*$")
BASE_RELEASE_CANDIDATES = 25
RELEASE_PAGES = 4
TAG_CANDIDATES = 5
ADVISORY_SOURCE = "github-published-advisories"
ADVISORY_ITEMS = 10


def stable_tags(tags: list[dict[str, Any]], pattern: re.Pattern[str] = STABLE_TAG) -> list[dict[str, Any]]:
    stable = [tag for tag in tags if pattern.match(tag["name"])]
    return sorted(stable, key=lambda tag: version_key(tag["name"]), reverse=True)


def rc_tags(tags: list[dict[str, Any]], pattern: re.Pattern[str] = STABLE_TAG) -> list[dict[str, Any]]:
    def order(tag: dict[str, Any]) -> tuple[tuple[int, ...], int]:
        match = RC_TAG.match(tag["name"])
        return version_key(match.group(1)), int(match.group(2) or 0)

    def ours(tag: dict[str, Any]) -> bool:
        return bool(RC_TAG.match(tag["name"])) and bool(pattern.match(RC_SUFFIX.sub("", tag["name"])))

    return sorted((tag for tag in tags if ours(tag)), key=order, reverse=True)


def _commit_date(commit: dict[str, Any]) -> str:
    return commit["commit"]["committer"]["date"]


def _is_fork_only(api: Api, base: str, upstream_ref: str, sha: str) -> bool:
    comparison = api(f"{base}/compare/{upstream_ref}...{sha}")
    return bool(comparison) and comparison["ahead_by"] > 0


def latest_fork_release(
    api: Api, base: str, upstream_ref: str, tags: list[dict[str, Any]], pattern: re.Pattern[str] = STABLE_TAG
) -> dict[str, Any] | None:
    """Newest tag matching the fork's release pattern whose commit is not in upstream."""
    for tag in stable_tags(tags, pattern)[:TAG_CANDIDATES]:
        sha = tag["commit"]["sha"]
        if _is_fork_only(api, base, upstream_ref, sha):
            commit = api(f"{base}/commits/{sha}")
            return {"tag": tag["name"], "date": _commit_date(commit) if commit else None}
    return None


def pending_release_candidate(
    api: Api, base: str, upstream_ref: str, tags: list[dict[str, Any]], release: dict[str, Any] | None, pattern: re.Pattern[str] = STABLE_TAG
) -> dict[str, Any] | None:
    """Newest fork-only release candidate that is newer than our latest stable release."""
    floor = version_key(release["tag"]) if release else ()
    newer = [tag for tag in rc_tags(tags, pattern) if version_key(RC_TAG.match(tag["name"]).group(1)) > floor]
    for tag in newer[:TAG_CANDIDATES]:
        if _is_fork_only(api, base, upstream_ref, tag["commit"]["sha"]):
            return {"tag": tag["name"]}
    return None


def upstream_releases(api: Api, upstream: str, pattern: re.Pattern[str] | None = None, page: int = 1) -> list[dict[str, Any]]:
    releases = api(f"repos/{upstream}/releases?per_page=100" + (f"&page={page}" if page > 1 else "")) or []
    wanted = [
        release
        for release in releases
        if not release["draft"] and not release["prerelease"] and (pattern is None or pattern.match(release["tag_name"]))
    ]
    return sorted(wanted, key=lambda release: release["published_at"], reverse=True)


def latest_upstream_release(
    api: Api, upstream: str, releases: list[dict[str, Any]], pattern: re.Pattern[str] | None = None
) -> dict[str, Any] | None:
    if releases:
        return {"tag": releases[0]["tag_name"], "date": releases[0]["published_at"]}
    tags = stable_tags(api(f"repos/{upstream}/tags?per_page=100") or [], pattern or STABLE_TAG)
    return {"tag": tags[0]["name"], "date": None} if tags else None


def release_lag(releases: list[dict[str, Any]], merged_at: str, fork_release: dict[str, Any] | None) -> dict[str, Any]:
    since = [release for release in releases if release["published_at"] > merged_at]
    ours = fork_release["date"] if fork_release else None
    latest = releases[0]["published_at"] if releases else None
    behind_days = _days_between(ours, latest) if ours and latest and latest > ours else None
    return {"upstream_releases_since_sync": len(since), "upstream_ahead_of_our_release_days": behind_days}


def _all_releases(api: Api, upstream: str, pattern: re.Pattern[str] | None, first_page: list[dict[str, Any]]) -> list[dict[str, Any]]:
    releases = list(first_page)
    for page in range(2, RELEASE_PAGES + 1):
        more = upstream_releases(api, upstream, pattern, page)
        if not more:
            break
        releases.extend(more)
    return releases


def fork_base_release(
    api: Api,
    base: str,
    upstream: str,
    pattern: re.Pattern[str] | None,
    fork_release: dict[str, Any] | None,
    releases: list[dict[str, Any]],
) -> str | None:
    """The highest-versioned upstream release that is in the history of our latest fork release."""
    if fork_release is None:
        return None
    owner = upstream.split("/")[0]
    newest_first = sorted(_all_releases(api, upstream, pattern, releases), key=lambda release: version_key(release["tag_name"]), reverse=True)
    for release in newest_first[:BASE_RELEASE_CANDIDATES]:
        comparison = api(f"{base}/compare/{owner}:{quote(release['tag_name'], safe='')}...{quote(fork_release['tag'], safe='')}")
        if comparison and comparison["behind_by"] == 0:
            return release["tag_name"]
    return None


def release_distance(api: Api, base: str, owner: str, production: str, upstream_release: dict[str, Any] | None) -> dict[str, int] | None:
    if upstream_release is None:
        return None
    comparison = api(f"{base}/compare/{owner}:{quote(upstream_release['tag'], safe='')}...{production}")
    return {"behind_release": comparison["behind_by"], "ahead_release": comparison["ahead_by"]} if comparison else None


def advisory_summary(api: Api, upstream: str, since: str | None, severe: list[str], base_release: str | None = None) -> dict[str, Any]:
    published = api(f"repos/{upstream}/security-advisories?per_page=100") or []
    base_version = version_key(base_release) if base_release else None
    items = [
        {
            "ghsa_id": advisory.get("ghsa_id"),
            "severity": advisory.get("severity"),
            "summary": advisory.get("summary"),
            "url": advisory.get("html_url"),
            "published_at": advisory["published_at"],
            "after_our_release": since is not None and advisory["published_at"] > since,
            "affects_fork_release": affects(base_version, advisory),
        }
        for advisory in sorted(published, key=lambda advisory: advisory["published_at"], reverse=True)
    ]
    newer = [item for item in items if item["after_our_release"]]
    affecting = [item for item in items if item["affects_fork_release"]]
    return {
        "published": len(items),
        "since_fork_release": len(newer),
        "severe_since_fork_release": sum(1 for item in newer if item["severity"] in severe),
        "affecting_fork_release": len(affecting),
        "severe_affecting_fork_release": sum(1 for item in affecting if item["severity"] in severe),
        "base_release": base_release,
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
    fork_pattern = re.compile(app.get("fork_release_tag", FORK_RELEASE_TAG))
    upstream_pattern = re.compile(app["release_tag"]) if "release_tag" in app else None
    release = latest_fork_release(api, base, upstream_ref, tags, fork_pattern)
    releases = upstream_releases(api, app["upstream"], upstream_pattern)
    upstream_release = latest_upstream_release(api, app["upstream"], releases, upstream_pattern)
    base_release = signals.guarded(lambda: fork_base_release(api, base, app["upstream"], upstream_pattern, release, releases))
    advisories = advisory_summary(
        api, app["upstream"], release["date"] if release else None, rules.get("critical_advisory_severities", []), base_release
    )
    distance = signals.guarded(lambda: release_distance(api, base, owner, production, upstream_release)) or {}
    days = _days_since(merged_at, now)
    return {
        "repo": app["repo"],
        "production_branch": production,
        "ahead_by": comparison["ahead_by"],
        "behind_by": comparison["behind_by"],
        "last_upstream_merge": merged_at,
        "days_since_upstream_merge": days,
        "fork_release": release,
        "release_candidate": pending_release_candidate(api, base, upstream_ref, tags, release, fork_pattern),
        "upstream_release": upstream_release,
        "behind_release": distance.get("behind_release"),
        "ahead_release": distance.get("ahead_release"),
        "release_lag": release_lag(releases, merged_at, release),
        "advisories": advisories,
        "promotion": promotion(api, base, production, staging),
        "ci": signals.guarded(lambda: signals.ci_status(api, base, production)),
        "pull_requests": signals.guarded(lambda: signals.open_pull_requests(api, base, production)),
        "maintainers": signals.guarded(lambda: signals.merged_by(merged_by, org, app["repo"], production)),
        "upstream_activity": signals.guarded(lambda: signals.upstream_activity(api, app["upstream"], now, rules.get("upstream_quiet_days", 120))),
        "status": classify(rules["statuses"], comparison["behind_by"], days, advisories["severe_since_fork_release"] > 0),
    }

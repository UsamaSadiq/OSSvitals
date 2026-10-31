from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any, Callable

from urllib.parse import quote

from collectors.fleet.ranges import VERSION, affects, version_key

Api = Callable[[str], Any]

STABLE_TAG = re.compile(r"^v?\d+(\.\d+)+$")
RC_TAG = re.compile(r"^v?(\d+(?:\.\d+)+)-rc[.\-]?(\d*)$")
RC_SUFFIX = re.compile(r"-rc[.\-]?\d*$")
BASE_RELEASE_CANDIDATES = 25
BASE_RELEASE_SLACK = timedelta(days=30)
RELEASE_PAGES = 4
TAG_CANDIDATES = 5
ADVISORY_SOURCE = "github-published-advisories"
ADVISORY_ITEMS = 10


def stable_tags(tags: list[dict[str, Any]], pattern: re.Pattern[str] = STABLE_TAG) -> list[dict[str, Any]]:
    stable = [tag for tag in tags if pattern.match(tag["name"]) and VERSION.search(tag["name"])]
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


def _release_page(api: Api, upstream: str, page: int) -> list[dict[str, Any]]:
    return api(f"repos/{upstream}/releases?per_page=100" + (f"&page={page}" if page > 1 else "")) or []


def _stable_releases(releases: list[dict[str, Any]], pattern: re.Pattern[str] | None) -> list[dict[str, Any]]:
    wanted = [
        release
        for release in releases
        if not release["draft"]
        and not release["prerelease"]
        and VERSION.search(release["tag_name"])
        and (pattern is None or pattern.match(release["tag_name"]))
    ]
    return sorted(wanted, key=lambda release: release["published_at"], reverse=True)


def upstream_releases(api: Api, upstream: str, pattern: re.Pattern[str] | None = None, page: int = 1) -> list[dict[str, Any]]:
    return _stable_releases(_release_page(api, upstream, page), pattern)


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


def all_upstream_releases(api: Api, upstream: str, pattern: re.Pattern[str] | None = None) -> list[dict[str, Any]]:
    releases: list[dict[str, Any]] = []
    for page in range(1, RELEASE_PAGES + 1):
        raw = _release_page(api, upstream, page)
        if not raw:
            break
        releases.extend(raw)
    return _stable_releases(releases, pattern)


def fork_base_release(
    api: Api,
    base: str,
    upstream: str,
    ref: str | None,
    releases: list[dict[str, Any]],
    merged_at: str,
) -> str | None:
    """The highest-versioned upstream release in the history of `ref`.

    A release published well after our last upstream merge cannot be in that history, so it is not compared.
    """
    if ref is None:
        return None
    owner = upstream.split("/")[0]
    latest_possible = _parse(merged_at) + BASE_RELEASE_SLACK
    possible = [release for release in releases if _parse(release["published_at"]) <= latest_possible]
    newest_first = sorted(possible, key=lambda release: version_key(release["tag_name"]), reverse=True)
    for release in newest_first[:BASE_RELEASE_CANDIDATES]:
        comparison = api(f"{base}/compare/{owner}:{quote(release['tag_name'], safe='')}...{quote(ref, safe='')}")
        if comparison and comparison["behind_by"] == 0:
            return release["tag_name"]
    return None


def release_distance(api: Api, base: str, owner: str, production: str, upstream_release: dict[str, Any] | None) -> dict[str, int] | None:
    if upstream_release is None:
        return None
    comparison = api(f"{base}/compare/{owner}:{quote(upstream_release['tag'], safe='')}...{production}")
    return {"behind_release": comparison["behind_by"], "ahead_release": comparison["ahead_by"]} if comparison else None


def code_since(merged_at: str, release_date: str | None) -> str:
    """The earlier of our last upstream merge and our latest release: a release cut before the merge still ships
    the older upstream code."""
    return min(merged_at, release_date) if release_date else merged_at


def advisory_summary(
    api: Api,
    upstream: str,
    since: str | None,
    severe: list[str],
    base_release: str | None = None,
    published: list[dict[str, Any]] | None = None,
    code_since: str | None = None,
) -> dict[str, Any]:
    """``published`` is the upstream's advisory list when the caller already has it. ``code_since`` is when the
    upstream code we ship was taken (see ``code_since``); an advisory fixed in code we already merged still counts
    until the next sync, since GitHub gives no reliable fix commit to tell otherwise."""
    if published is None:
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
    since_code = [item for item in items if code_since is not None and item["published_at"] > code_since]
    affecting = [item for item in items if item["affects_fork_release"]]
    return {
        "published": len(items),
        "since_fork_release": len(newer),
        "severe_since_fork_release": sum(1 for item in newer if item["severity"] in severe),
        "since_our_code": len(since_code),
        "severe_since_our_code": sum(1 for item in since_code if item["severity"] in severe),
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

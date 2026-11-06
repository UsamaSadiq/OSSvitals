from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any, Callable

from urllib.parse import quote

from collectors.fleet.ranges import VERSION, affects, is_release_name, version_key

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
LITERAL_PREFIX = re.compile(r"^\^((?:[A-Za-z0-9_/-](?![?*{]))*)")
TAG_REF_PREFIX = "refs/tags/"


def literal_prefix(pattern: re.Pattern[str]) -> str:
    """The characters every match must start with; none when the pattern has alternatives."""
    if "|" in pattern.pattern:
        return ""
    match = LITERAL_PREFIX.match(pattern.pattern)
    return match.group(1) if match else ""


def _tag_from_ref(ref: dict[str, Any]) -> dict[str, Any]:
    """In the shape of the tags endpoint. An annotated tag's ref points at the tag object, not its commit, so its name
    stands in for the commit: the compare and commit endpoints resolve a tag name to its commit."""
    name = ref["ref"].removeprefix(TAG_REF_PREFIX)
    target = ref["object"]
    return {"name": name, "commit": {"sha": target["sha"] if target["type"] == "commit" else quote(name, safe="")}}


def list_tags(api: Api, base: str, pattern: re.Pattern[str]) -> list[dict[str, Any]]:
    """Every tag under the pattern's literal prefix, in one call, so a repo with thousands of tags (edx-platform has
    over 1,600) still lists every match; without a prefix, the newest 100 of the tags endpoint."""
    prefix = literal_prefix(pattern)
    if prefix:
        return [_tag_from_ref(ref) for ref in api(f"{base}/git/matching-refs/tags/{quote(prefix, safe='/')}") or []]
    return api(f"{base}/tags?per_page=100") or []


def stable_tags(tags: list[dict[str, Any]], pattern: re.Pattern[str] = STABLE_TAG) -> list[dict[str, Any]]:
    stable = [tag for tag in tags if is_release_name(tag["name"], pattern)]
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
        and (is_release_name(release["tag_name"], pattern) if pattern else bool(VERSION.search(release["tag_name"])))
    ]
    return sorted(wanted, key=lambda release: release["published_at"], reverse=True)


def upstream_releases(api: Api, upstream: str, pattern: re.Pattern[str] | None = None, page: int = 1) -> list[dict[str, Any]]:
    return _stable_releases(_release_page(api, upstream, page), pattern)


def upstream_release_tags(api: Api, upstream: str, pattern: re.Pattern[str] | None = None) -> list[dict[str, Any]]:
    """Upstream's stable tags, newest version first: its releases when it tags them without publishing them."""
    line = pattern or STABLE_TAG
    return stable_tags(list_tags(api, f"repos/{upstream}", line), line)


def latest_upstream_release(
    api: Api,
    upstream: str,
    releases: list[dict[str, Any]],
    pattern: re.Pattern[str] | None = None,
    tags: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    """``tags`` is upstream's release tags when the caller already has them."""
    if releases:
        return {"tag": releases[0]["tag_name"], "date": releases[0]["published_at"]}
    if tags is None:
        tags = upstream_release_tags(api, upstream, pattern)
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
    latest_possible = _parse(merged_at) + BASE_RELEASE_SLACK
    possible = [release for release in releases if _parse(release["published_at"]) <= latest_possible]
    newest_first = sorted((release["tag_name"] for release in possible), key=version_key, reverse=True)
    return _newest_in_history(api, base, upstream, ref, newest_first)


def fork_base_tag(api: Api, base: str, upstream: str, ref: str | None, tags: list[dict[str, Any]]) -> str | None:
    """The highest-versioned upstream release tag in the history of `ref`, for an upstream that publishes no releases.

    A fork that follows upstream's stable line contains its release tags even when it is far behind the
    development branch. Tags carry no publication date, so every candidate is compared, newest version first.
    """
    return _newest_in_history(api, base, upstream, ref, [tag["name"] for tag in tags])


def _newest_in_history(api: Api, base: str, upstream: str, ref: str | None, newest_first: list[str]) -> str | None:
    if ref is None:
        return None
    owner = upstream.split("/")[0]
    for tag in newest_first[:BASE_RELEASE_CANDIDATES]:
        comparison = api(f"{base}/compare/{owner}:{quote(tag, safe='')}...{quote(ref, safe='')}")
        if comparison and comparison["behind_by"] == 0:
            return tag
    return None


def tag_date(api: Api, upstream: str, tag: dict[str, Any]) -> str | None:
    commit = api(f"repos/{upstream}/commits/{tag['commit']['sha']}")
    return _commit_date(commit) if commit else None


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
    highest_release: str | None = None,
) -> dict[str, Any]:
    """``published`` is the upstream's advisory list when the caller already has it. ``code_since`` is when the
    upstream code we ship was taken (see ``code_since``); an advisory fixed in code we already merged still counts
    until the next sync, since GitHub gives no reliable fix commit to tell otherwise. ``highest_release`` is
    upstream's highest release version: an advisory naming versions upstream could not have reached is undetermined."""
    if published is None:
        published = api(f"repos/{upstream}/security-advisories?per_page=100") or []
    base_version = version_key(base_release) if base_release else None
    latest_version = version_key(highest_release) if highest_release else None
    items = [
        {
            "ghsa_id": advisory.get("ghsa_id"),
            "severity": advisory.get("severity"),
            "summary": advisory.get("summary"),
            "url": advisory.get("html_url"),
            "published_at": advisory["published_at"],
            "after_our_release": since is not None and advisory["published_at"] > since,
            "affects_fork_release": affects(base_version, advisory, latest_version),
        }
        for advisory in sorted(published, key=lambda advisory: advisory["published_at"], reverse=True)
    ]
    newer = [item for item in items if item["after_our_release"]]
    since_code = [item for item in items if code_since is not None and item["published_at"] > code_since]
    affecting = [item for item in items if item["affects_fork_release"]]
    undetermined = [item for item in items if base_version and item["affects_fork_release"] is None]
    return {
        "published": len(items),
        "since_fork_release": len(newer),
        "severe_since_fork_release": sum(1 for item in newer if item["severity"] in severe),
        "since_our_code": len(since_code),
        "severe_since_our_code": sum(1 for item in since_code if item["severity"] in severe),
        "affecting_fork_release": len(affecting),
        "severe_affecting_fork_release": sum(1 for item in affecting if item["severity"] in severe),
        "undetermined_fork_release": len(undetermined),
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

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Callable

from collectors.moneta.status import classify

Api = Callable[[str], Any]

STABLE_TAG = re.compile(r"^v?\d+(\.\d+)+$")
TAG_CANDIDATES = 5
ADVISORY_SOURCE = "github-published-advisories"


def version_key(tag: str) -> tuple[int, ...]:
    return tuple(int(part) for part in tag.lstrip("v").split("."))


def stable_tags(tags: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stable = [tag for tag in tags if STABLE_TAG.match(tag["name"])]
    return sorted(stable, key=lambda tag: version_key(tag["name"]), reverse=True)


def _commit_date(commit: dict[str, Any]) -> str:
    return commit["commit"]["committer"]["date"]


def latest_fork_release(api: Api, base: str, upstream_ref: str) -> dict[str, Any] | None:
    """Newest stable tag whose commit is not in upstream; tags inherited from upstream are skipped."""
    for tag in stable_tags(api(f"{base}/tags?per_page=100") or [])[:TAG_CANDIDATES]:
        sha = tag["commit"]["sha"]
        comparison = api(f"{base}/compare/{upstream_ref}...{sha}")
        if comparison and comparison["ahead_by"] > 0:
            commit = api(f"{base}/commits/{sha}")
            return {"tag": tag["name"], "date": _commit_date(commit) if commit else None}
    return None


def latest_upstream_release(api: Api, upstream: str) -> dict[str, Any] | None:
    release = api(f"repos/{upstream}/releases/latest")
    if release:
        return {"tag": release["tag_name"], "date": release["published_at"]}
    tags = stable_tags(api(f"repos/{upstream}/tags?per_page=100") or [])
    return {"tag": tags[0]["name"], "date": None} if tags else None


def advisories_since(api: Api, upstream: str, since: str | None) -> dict[str, Any]:
    published = [a["published_at"] for a in api(f"repos/{upstream}/security-advisories?per_page=100") or []]
    newer = [date for date in published if since is not None and date > since]
    return {"published": len(published), "since_fork_release": len(newer), "source": ADVISORY_SOURCE}


def promotion(api: Api, base: str, production: str, staging: str | None) -> dict[str, Any] | None:
    if staging is None:
        return None
    comparison = api(f"{base}/compare/{production}...{staging}")
    return {"unpromoted_commits": comparison["ahead_by"]} if comparison else None


def _days_since(iso_date: str, now: datetime) -> int:
    return (now - datetime.fromisoformat(iso_date.replace("Z", "+00:00"))).days


def collect_fork(api: Api, org: str, app: dict[str, Any], rules: dict[str, Any], now: datetime) -> dict[str, Any]:
    base = f"repos/{org}/{app['repo']}"
    owner = app["upstream"].split("/")[0]
    production = app.get("production_branch", rules["branches"]["production"])
    staging = None if "production_branch" in app else rules["branches"]["staging"]
    upstream_ref = f"{owner}:{app['upstream_branch']}"
    comparison = api(f"{base}/compare/{upstream_ref}...{production}")
    if comparison is None:
        raise LookupError(f"cannot compare {upstream_ref} with {production}")
    merged_at = comparison["merge_base_commit"]["commit"]["committer"]["date"]
    release = latest_fork_release(api, base, upstream_ref)
    advisories = advisories_since(api, app["upstream"], release["date"] if release else None)
    days = _days_since(merged_at, now)
    return {
        "repo": app["repo"],
        "production_branch": production,
        "ahead_by": comparison["ahead_by"],
        "behind_by": comparison["behind_by"],
        "last_upstream_merge": merged_at,
        "days_since_upstream_merge": days,
        "fork_release": release,
        "upstream_release": latest_upstream_release(api, app["upstream"]),
        "advisories": advisories,
        "promotion": promotion(api, base, production, staging),
        "status": classify(rules["statuses"], comparison["behind_by"], days, advisories["since_fork_release"] > 0),
    }

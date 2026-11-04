"""How far an app's pinned ref is behind its newest release.

A pin is the ref a tenant's production build installs, set by hand per app as ``pin``. For our own repos the
releases are our tags (``fork_release_tag``); for a ``dependency`` (a third-party repo we install but do not fork)
and an ``original`` they are the repo's stable tags, or its ``release_tag`` line when it sets one.
"""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

from collectors.fleet.fork import STABLE_TAG, Api, list_tags
from collectors.fleet.ranges import is_release_name, version_key
from collectors.fleet.repos import full_name

CURRENT = "current"
BEHIND = "behind"
UNKNOWN = "unknown"


def release_pattern(app: dict[str, Any], fork_release_tag: str) -> re.Pattern[str]:
    if app["class"] == "fork":
        return re.compile(app.get("fork_release_tag", fork_release_tag))
    return re.compile(app["release_tag"]) if "release_tag" in app else STABLE_TAG


def releases(api: Api, base: str, pattern: re.Pattern[str]) -> list[str]:
    names = (tag["name"] for tag in list_tags(api, base, pattern) if is_release_name(tag["name"], pattern))
    return sorted(names, key=version_key, reverse=True)


def _pin_kind(api: Api, base: str, pin: str, known_tags: list[str]) -> str:
    if pin in known_tags or api(f"{base}/git/ref/tags/{quote(pin, safe='')}"):
        return "tag"
    if api(f"{base}/branches/{quote(pin, safe='')}"):
        return "branch"
    return "commit"


def _releases_behind(pin: str, ordered: list[str], pattern: re.Pattern[str]) -> int | None:
    """Only a pin on the release line itself can be counted in releases; a branch or commit is counted in commits."""
    if not is_release_name(pin, pattern):
        return None
    pinned = version_key(pin)
    return sum(1 for tag in ordered if version_key(tag) > pinned)


def _commits_behind(api: Api, base: str, pin: str, latest: str) -> int | None:
    if pin == latest:
        return 0
    comparison = api(f"{base}/compare/{quote(pin, safe='')}...{quote(latest, safe='')}")
    return comparison["ahead_by"] if comparison else None


def status(latest: str | None, releases_behind: int | None, commits_behind: int | None) -> str:
    distance = releases_behind if releases_behind is not None else commits_behind
    if latest is None or distance is None:
        return UNKNOWN
    return CURRENT if distance == 0 else BEHIND


def pin_record(api: Api, github_org: str, app: dict[str, Any], fork_release_tag: str) -> dict[str, Any]:
    name = full_name(github_org, app)
    base = f"repos/{name}"
    pin = app["pin"]
    pattern = release_pattern(app, fork_release_tag)
    ordered = releases(api, base, pattern)
    latest = ordered[0] if ordered else None
    releases_behind = _releases_behind(pin, ordered, pattern)
    commits_behind = _commits_behind(api, base, pin, latest) if latest else None
    return {
        "repo": app["repo"],
        "full_name": name,
        "class": app["class"],
        "group": app.get("group"),
        "pin": pin,
        "pin_kind": _pin_kind(api, base, pin, ordered),
        "pin_note": app.get("pin_note"),
        "latest_release": latest,
        "releases_behind": releases_behind,
        "commits_behind": commits_behind,
        "status": status(latest, releases_behind, commits_behind),
    }

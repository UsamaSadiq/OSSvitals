from __future__ import annotations

from datetime import datetime
from typing import Any, Callable

from collectors.fleet.ranges import Version, version_key

GAP_LEVELS = ("none", "patch", "minor", "major")


def _is_initial_development(version: Version) -> bool:
    """Semver 0.x: the minor number is the breaking part and the patch number carries everything else."""
    return version[0] == 0 and len(version) > 1


def gap_level(base: Version, latest: Version) -> str:
    width = max(len(base), len(latest))
    base, latest = base + (0,) * (width - len(base)), latest + (0,) * (width - len(latest))
    if latest <= base:
        return "none"
    if _is_initial_development(base):
        return "major" if latest[:2] != base[:2] else "patch"
    if latest[0] != base[0]:
        return "major"
    return "minor" if latest[:2] != base[:2] else "patch"


def _days_since(iso_date: str, now: datetime) -> int:
    return (now - datetime.fromisoformat(iso_date.replace("Z", "+00:00"))).days


def release_gap(base_tag: str | None, base_ref: str | None, releases: list[dict[str, Any]], now: datetime) -> dict[str, Any] | None:
    """How far the upstream release we are built on trails upstream's newest release; None without both."""
    if base_tag is None or not releases:
        return None
    base = version_key(base_tag)
    oldest_missing = min((release["published_at"] for release in releases if version_key(release["tag_name"]) > base), default=None)
    return _gap(base_tag, base_ref, [release["tag_name"] for release in releases], oldest_missing, now)


def tag_release_gap(
    base_tag: str | None, base_ref: str | None, tags: list[dict[str, Any]], now: datetime, tag_date: Callable[[dict[str, Any]], str | None]
) -> dict[str, Any] | None:
    """``release_gap`` for an upstream that tags releases without publishing them. A tag has no publication date, so
    the commit date of the lowest version we lack stands in for it, looked up only when we lack one."""
    if base_tag is None or not tags:
        return None
    base = version_key(base_tag)
    first_missing = min((tag for tag in tags if version_key(tag["name"]) > base), key=lambda tag: version_key(tag["name"]), default=None)
    return _gap(base_tag, base_ref, [tag["name"] for tag in tags], tag_date(first_missing) if first_missing else None, now)


def _gap(base_tag: str, base_ref: str | None, names: list[str], oldest_missing: str | None, now: datetime) -> dict[str, Any]:
    base = version_key(base_tag)
    latest = max(names, key=version_key)
    return {
        "base": base_tag,
        "base_ref": base_ref,
        "latest": latest,
        "releases_behind": sum(1 for name in names if version_key(name) > base),
        "level": gap_level(base, version_key(latest)),
        "days_behind": _days_since(oldest_missing, now) if oldest_missing else 0,
    }

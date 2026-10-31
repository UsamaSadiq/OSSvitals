"""What could bite at the next sync: migrations added on both sides, and upstream release notes that flag breaking changes."""
from __future__ import annotations

import re
from pathlib import Path, PurePosixPath
from typing import Any

from collectors.fleet.patches import LISTING, _git
from collectors.fleet.ranges import version_key

ITEMS = 10
NOTE_LINES = 3
NOTE_WIDTH = 200
TEST_ROOTS = {"spec", "test", "tests", "__tests__"}
PREFIX = re.compile(r"^(\d+)")
# Specific phrases only: a bare "breaking" also matches fixes such as "heading anchor breaking IME composition".
BREAKING = re.compile(
    r"breaking[ _-]?changes?|(?-i:\bBREAKING\b)|backwards?[- ]incompatible|upgrade steps? (is |are )?required"
    r"|migration (is )?required|requires? (a )?(manual|database) migration|manual migration",
    re.IGNORECASE,
)


def added_files(directory: Path, revisions: str) -> list[str]:
    listed = _git(directory, "log", "--format=", "--name-only", "-z", "--diff-filter=A", *LISTING, revisions)
    return sorted({path.strip("\n") for path in listed.split("\0") if path.strip("\n")})


def migration_dir(path: str, dir_names: list[str]) -> str | None:
    """The migrations folder a file sits in, unless it lives under a test tree."""
    parts = PurePosixPath(path).parts
    if parts and parts[0] in TEST_ROOTS:
        return None
    for index in range(len(parts) - 1, 0, -1):
        if parts[index - 1] in dir_names:
            return "/".join(parts[:index])
    return None


def _by_dir(paths: list[str], dir_names: list[str]) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = {}
    for path in paths:
        folder = migration_dir(path, dir_names)
        if folder:
            grouped.setdefault(folder, []).append(path)
    return grouped


def _prefix(path: str) -> str | None:
    match = PREFIX.match(PurePosixPath(path).name)
    return match.group(1) if match else None


def migrations(ours: list[str], theirs: list[str], dir_names: list[str]) -> dict[str, Any]:
    """Folders where both sides added migrations, and files in one folder sharing a number prefix.

    A file both sides added under the same path is one migration we took from upstream, not ours.
    """
    ours = sorted(set(ours) - set(theirs))
    our_dirs, their_dirs = _by_dir(ours, dir_names), _by_dir(theirs, dir_names)
    shared = sorted(set(our_dirs) & set(their_dirs))
    same_prefix = [
        {"dir": folder, "prefix": prefix, "ours": [p for p in our_dirs[folder] if _prefix(p) == prefix], "upstream": [p for p in their_dirs[folder] if _prefix(p) == prefix]}
        for folder in shared
        for prefix in sorted({_prefix(p) for p in our_dirs[folder]} & {_prefix(p) for p in their_dirs[folder]} - {None})
    ]
    our_files = [path for paths in our_dirs.values() for path in paths]
    their_files = [path for paths in their_dirs.values() for path in paths]
    return {
        "ours": len(our_files),
        "upstream": len(their_files),
        "shared_dirs": shared,
        "same_prefix": same_prefix,
        "ours_items": sorted(our_files, reverse=True)[:ITEMS],
        "upstream_items": sorted(their_files, reverse=True)[:ITEMS],
    }


def _newer(release: dict[str, Any], base_release: str | None, merged_at: str) -> bool:
    if base_release:
        return version_key(release["tag_name"]) > version_key(base_release)
    return release["published_at"] > merged_at


def _flagged_lines(body: str | None) -> list[str]:
    lines = [line.strip().lstrip("#*- ").strip() for line in (body or "").splitlines()]
    return [line[:NOTE_WIDTH] for line in lines if line and BREAKING.search(line)][:NOTE_LINES]


def release_notes(releases: list[dict[str, Any]], base_release: str | None, merged_at: str) -> dict[str, Any]:
    """Upstream releases we have not synced yet, keeping those whose notes flag breaking changes or required steps."""
    pending = [release for release in releases if _newer(release, base_release, merged_at)]
    flagged = [
        {"tag": release["tag_name"], "url": release.get("html_url"), "published_at": release.get("published_at"), "lines": lines}
        for release in pending
        if (lines := _flagged_lines(release.get("body")))
    ]
    return {"basis": "release" if base_release else "commits", "since": base_release, "releases": len(pending), "flagged": flagged[:ITEMS]}

"""What could bite at the next sync: migrations on both sides, and upstream release notes that flag breaking changes."""
from __future__ import annotations

import re
from pathlib import Path, PurePosixPath
from typing import Any

from collectors.fleet.patches import _git
from collectors.fleet.ranges import _padded, version_key

ITEMS = 10
NOTE_LINES = 3
NOTE_WIDTH = 200
TEST_ROOTS = {"spec", "test", "tests", "__tests__"}
# A date-shaped prefix is one timestamp (Laravel's 2024_03_01_000000, Diesel's 2024-03-01-000000); otherwise the
# leading number, unless it runs into a hex letter, which makes it an Alembic revision id, not a sequence number.
DATED = re.compile(r"^(\d{4})[-_](\d{2})[-_](\d{2})[-_](\d{6})")
PREFIX = re.compile(r"^(\d+)(?![0-9a-fA-F])")
# Sequential numbers (0042_, 007_) collide when both sides add one; Rails-style timestamps (14 digits) rarely do.
SEQUENTIAL_DIGITS = 8
# Specific phrases only: a bare "breaking" also matches fixes such as "heading anchor breaking IME composition".
BREAKING = re.compile(
    r"not backwards?[- ]compatible|breaking[ _-]?changes?|(?-i:\bBREAKING\b)|^breaking\b|backwards?[- ]incompatible"
    r"|incompatible changes?|^major changes$|upgrade steps? (is |are )?required|migrations? (is |are )?required"
    r"|requires? (a )?(manual|database) migration|manual migration",
    re.IGNORECASE,
)
# A negation word followed by a hyphen is part of a compound ("zero-downtime"), except "non-" right before the phrase.
NEGATED = re.compile(r"\b(no|non|not|without|zero)\b(?!-)[\w\s-]{0,15}$|\bnon-$", re.IGNORECASE)


def net_added(directory: Path, base: str, tip: str) -> list[str]:
    """Files present at ``tip`` but not at ``base``: a migration added and later removed or renamed does not count."""
    listed = _git(directory, "diff", "--name-only", "-z", "--no-renames", "--diff-filter=A", base, tip)
    return sorted({path for path in listed.split("\0") if path})


def migration(path: str, dir_names: list[str]) -> tuple[str, str] | None:
    """The folder a migration sits in and its entry name: a file directly in a migrations folder, a numbered file
    in a subfolder of one (penpot's ``migrations/sql/0140-x.sql``), or an unnumbered file whose folder is the
    migration (Prisma's ``migrations/20240101_x/migration.sql``). Nothing under a test tree or ``__init__.py``."""
    parts = PurePosixPath(path).parts
    if any(part in TEST_ROOTS for part in parts) or parts[-1] == "__init__.py":
        return None
    folder, name = parts[:-1], parts[-1]
    if folder and folder[-1] in dir_names:
        return "/".join(folder), name
    if len(folder) >= 2 and folder[-2] in dir_names:
        return ("/".join(folder), name) if _prefix(name) else ("/".join(folder[:-1]), folder[-1])
    return None


def _by_dir(paths: list[str], dir_names: list[str]) -> dict[str, set[str]]:
    grouped: dict[str, set[str]] = {}
    for path in paths:
        found = migration(path, dir_names)
        if found:
            grouped.setdefault(found[0], set()).add(found[1])
    return grouped


def _prefix(entry: str) -> str | None:
    dated = DATED.match(entry)
    if dated:
        return "".join(dated.groups())
    match = PREFIX.match(entry)
    return match.group(1) if match else None


def _sequential(entries: set[str]) -> bool:
    prefixes = [prefix for prefix in map(_prefix, entries) if prefix]
    return bool(prefixes) and all(len(prefix) < SEQUENTIAL_DIGITS for prefix in prefixes)


def migrations(ours: list[str], theirs: list[str], dir_names: list[str]) -> dict[str, Any]:
    """Migrations we carry against those upstream added since our last sync.

    ``ours`` and ``theirs`` are files present at each tip but not at the merge base; an entry both sides have is one
    migration we took from upstream. A risk is a number used on both sides in one folder, or both sides adding
    sequentially numbered migrations to one folder (they need renumbering or a merge migration).
    """
    our_dirs, their_dirs = _by_dir(ours, dir_names), _by_dir(theirs, dir_names)
    our_dirs = {folder: entries - their_dirs.get(folder, set()) for folder, entries in our_dirs.items()}
    our_dirs = {folder: entries for folder, entries in our_dirs.items() if entries}
    shared = sorted(set(our_dirs) & set(their_dirs))
    same_prefix = [
        {
            "dir": folder,
            "prefix": prefix,
            "ours": sorted(entry for entry in our_dirs[folder] if _prefix(entry) == prefix),
            "upstream": sorted(entry for entry in their_dirs[folder] if _prefix(entry) == prefix),
        }
        for folder in shared
        for prefix in sorted({_prefix(entry) for entry in our_dirs[folder]} & {_prefix(entry) for entry in their_dirs[folder]} - {None})
    ]
    return {
        "ours": sum(len(entries) for entries in our_dirs.values()),
        "upstream": sum(len(entries) for entries in their_dirs.values()),
        "shared_dirs": shared,
        "sequential_dirs": [folder for folder in shared if _sequential(our_dirs[folder] | their_dirs[folder])],
        "same_prefix": same_prefix,
    }


def _flags(line: str) -> bool:
    """A match counts unless a negation ("no", "non", "without") comes just before it in the same clause."""
    return any(not NEGATED.search(line[: match.start()]) for match in BREAKING.finditer(line))


def _flagged_lines(body: str | None) -> list[str]:
    lines = [line.strip().lstrip("#*- ").strip() for line in (body or "").splitlines()]
    flagged = [line[:NOTE_WIDTH] for line in lines if line and _flags(line)]
    return list(dict.fromkeys(flagged))[:NOTE_LINES]


def _newer(tag: str, than: str) -> bool:
    left, right = _padded(version_key(tag), version_key(than))
    return left > right


def _synced_floor(releases: list[dict[str, Any]], merged_at: str) -> str | None:
    """Without a known base release: the highest release out by our last upstream merge."""
    out = [release["tag_name"] for release in releases if release["published_at"] <= merged_at]
    best: str | None = None
    for tag in out:
        if best is None or _newer(tag, best):
            best = tag
    return best


def release_notes(releases: list[dict[str, Any]], base_release: str | None, merged_at: str) -> dict[str, Any]:
    """Upstream releases above the one our production branch is built on, keeping those whose notes flag breaking
    changes or required steps. Without a base, releases above the newest one out by our last merge count, so a
    backport on an older line is not mistaken for something we lack."""
    floor = base_release or _synced_floor(releases, merged_at)
    pending = [release for release in releases if (_newer(release["tag_name"], floor) if floor else release["published_at"] > merged_at)]
    flagged = [
        {"tag": release["tag_name"], "url": release.get("html_url"), "published_at": release.get("published_at"), "lines": lines}
        for release in pending
        if (lines := _flagged_lines(release.get("body")))
    ]
    return {"basis": "release" if base_release else "commits", "since": floor, "releases": len(pending), "flagged": flagged[:ITEMS]}

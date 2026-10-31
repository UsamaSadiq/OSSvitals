"""Which of our commits upstream already has, from a blob-less clone holding both branches.

``git log --cherry-mark`` compares patches by content, so the file versions those commits touch must be
local. Fetching them lazily costs a round trip per commit (over ten minutes for zammad); listing them
with ``--raw`` and fetching each side in one request takes about a minute.
"""
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

ITEMS = 20
NULL_OBJECT = "0" * 40
TIMEOUT_SECONDS = 900
# Rename detection reads file contents to score similarity, which would fetch them one commit at a time and
# report only a renamed file's new path; patch ids are computed without it anyway.
LISTING = ("--no-renames", "--no-merges")


def _git(directory: Path, *args: str, stdin: str | None = None) -> str:
    try:
        result = subprocess.run(["git", "-C", str(directory), *args], input=stdin, capture_output=True, text=True, timeout=TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f"git {args[0]} took over {TIMEOUT_SECONDS}s") from error
    if result.returncode != 0:
        raise RuntimeError(f"git {args[0]} failed: {result.stderr.strip()[:300]}")
    return result.stdout


def _lines(text: str) -> list[str]:
    return [line for line in text.splitlines() if line]


def fork_only_paths(directory: Path, upstream: str, ours: str) -> list[str]:
    """NUL-separated, so a non-ASCII name comes back as itself rather than C-quoted."""
    listed = _git(directory, "log", "--format=", "--name-only", "-z", *LISTING, f"{upstream}..{ours}")
    return sorted({path.strip("\n") for path in listed.split("\0") if path.strip("\n")})


def changed_blobs(directory: Path, revisions: str, paths: list[str] | None = None) -> set[str]:
    """Before and after versions of every file the commits in ``revisions`` change, limited to ``paths``.

    Revisions and paths go on stdin: a fork touching tens of thousands of files would overflow the command line.
    """
    pathspec = "--\n" + "\n".join(paths) + "\n" if paths else ""
    raw = _git(directory, "--literal-pathspecs", "log", "--format=", "--raw", "--no-abbrev", *LISTING, "--stdin", stdin=f"{revisions}\n{pathspec}")
    blobs = {field for line in _lines(raw) if line.startswith(":") for field in line.split()[2:4]}
    return blobs - {NULL_OBJECT}


def prefetch(directory: Path, remote: str, blobs: set[str]) -> None:
    if blobs:
        _git(
            directory,
            "-c",
            "fetch.negotiationAlgorithm=noop",
            "fetch",
            "--quiet",
            "--no-tags",
            "--no-write-fetch-head",
            "--filter=blob:none",
            remote,
            "--stdin",
            stdin="\n".join(sorted(blobs)) + "\n",
        )


def _commits(text: str) -> list[dict[str, Any]]:
    commits = []
    for line in _lines(text):
        mark, sha, date, subject = (line.split("\t", 3) + ["", "", ""])[:4]
        commits.append({"mark": mark, "sha": sha, "date": date or None, "subject": subject})
    return commits


def marked_commits(directory: Path, upstream: str, ours: str, compare: bool) -> list[dict[str, Any]]:
    """Our non-merge commits, newest first; ``=`` marks one whose change upstream already has."""
    marking = ["--cherry-mark"] if compare else []
    return _commits(_git(directory, "log", *marking, "--right-only", *LISTING, "--format=%m%x09%H%x09%cs%x09%s", f"{upstream}...{ours}"))


def _items(commits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{key: commit[key] for key in ("sha", "date", "subject")} for commit in commits[:ITEMS]]


def carried(directory: Path, ours: str, upstream: str, fork_remote: str, upstream_remote: str, max_blobs: int) -> dict[str, Any]:
    """Too many file versions to fetch means our commits are listed but not compared (``compared: false``)."""
    merge_base = _git(directory, "merge-base", upstream, ours).strip()
    paths = fork_only_paths(directory, upstream, ours)
    fork_blobs = changed_blobs(directory, f"{upstream}..{ours}")
    upstream_blobs = changed_blobs(directory, f"{merge_base}..{upstream}", paths) if paths else set()
    compare = len(fork_blobs) + len(upstream_blobs) <= max_blobs
    if compare:
        prefetch(directory, fork_remote, fork_blobs)
        prefetch(directory, upstream_remote, upstream_blobs)
    commits = marked_commits(directory, upstream, ours, compare)
    already = [commit for commit in commits if commit["mark"] == "="]
    kept = [commit for commit in commits if commit["mark"] != "="]
    return {
        "compared": compare,
        "commits": len(commits),
        "carried": len(kept) if compare else None,
        "already_upstream": len(already) if compare else None,
        "carried_items": _items(kept),
        "already_upstream_items": _items(already),
    }

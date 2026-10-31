from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

FILE_LIMIT = 50
CLEAN_EXIT = 0
CONFLICT_EXIT = 1
UPSTREAM_HEAD_REF = "refs/fleet/upstream-head"
UPSTREAM_RELEASE_REF = "refs/fleet/upstream-release"


def _git(repo_dir: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", "-C", str(repo_dir), *args], capture_output=True, text=True)


def forecast(repo_dir: Path, ours: str, theirs: str) -> dict[str, Any]:
    """Merge ``theirs`` into ``ours`` in memory and report the files that would conflict."""
    result = _git(repo_dir, "merge-tree", "--write-tree", "--name-only", "--no-messages", ours, theirs)
    if result.returncode not in (CLEAN_EXIT, CONFLICT_EXIT) or not result.stdout.strip():
        raise RuntimeError(f"git merge-tree failed: {result.stderr.strip()}")
    files = [line for line in result.stdout.splitlines()[1:] if line] if result.returncode == CONFLICT_EXIT else []
    return {"clean": not files, "conflicted_files": files[:FILE_LIMIT], "conflicted_total": len(files)}


def prepare_clone(directory: Path, fork_url: str, production: str, upstream_url: str, upstream_branch: str, release_tag: str | None) -> None:
    """Commit and tree history only; file contents are fetched when a merge needs them."""
    clone = subprocess.run(
        ["git", "clone", "--bare", "--filter=blob:none", "--single-branch", "--branch", production, fork_url, str(directory)],
        capture_output=True,
        text=True,
    )
    if clone.returncode != 0:
        raise RuntimeError(f"clone failed: {clone.stderr.strip()}")
    refspecs = [f"+refs/heads/{upstream_branch}:{UPSTREAM_HEAD_REF}"]
    if release_tag:
        refspecs.append(f"+refs/tags/{release_tag}:{UPSTREAM_RELEASE_REF}")
    fetch = _git(directory, "fetch", "--filter=blob:none", upstream_url, *refspecs)
    if fetch.returncode != 0:
        raise RuntimeError(f"upstream fetch failed: {fetch.stderr.strip()}")


def collect_forecast(directory: Path, production: str, release_tag: str | None) -> dict[str, Any]:
    ours = f"refs/heads/{production}"
    against_head = forecast(directory, ours, UPSTREAM_HEAD_REF)
    against_release = {"tag": release_tag, **forecast(directory, ours, UPSTREAM_RELEASE_REF)} if release_tag else None
    return {"against_upstream_head": against_head, "against_upstream_release": against_release}

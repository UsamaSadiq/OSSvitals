"""Read a monolith's git history from a local bare clone for ``collectors/platform_trends.py``."""
from __future__ import annotations

import subprocess
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from collectors.fleet.git_env import run_git
from collectors.platform_trends import Commit, FileChange, is_counted_python, month_end, month_key, renamed_path

RECORD = "\x1e"
UNIT = "\x1f"
LOG_FORMAT = f"--format={RECORD}%H{UNIT}%cI{UNIT}%aN{UNIT}%aE{UNIT}%s"


class HistoryError(RuntimeError):
    pass


def _failure(label: str, result: subprocess.CompletedProcess[str]) -> HistoryError:
    """The exit code and git's last stderr line; callers publish it only through ``public_message``."""
    last = next((line for line in reversed(result.stderr.splitlines()) if line.strip()), "")
    return HistoryError(f"{label} failed with exit code {result.returncode}{f': {last.strip()}' if last else ''}")


def _git(git_dir: Path, args: list[str], *, url: str, label: str, ok: tuple[int, ...] = (0,)) -> str:
    result = run_git(["--git-dir", str(git_dir), *args], url=url, label=label)
    if result.returncode not in ok:
        raise _failure(label, result)
    return result.stdout


def clone(url: str, ref: str, *, since: date, dest: Path) -> None:
    """A bare clone of ``ref`` alone, with history back to ``since``: enough for the series and far smaller than a full clone."""
    args = ["clone", "--quiet", "--bare", "--single-branch", "--branch", ref, f"--shallow-since={since.isoformat()}", url, str(dest)]
    result = run_git(args, url=url, label="clone")
    if result.returncode != 0:
        raise _failure("clone", result)


def head(git_dir: Path, ref: str, *, url: str) -> str:
    return _git(git_dir, ["rev-parse", ref], url=url, label="rev-parse").strip()


def _shallow_roots(git_dir: Path) -> set[str]:
    """Commits whose parents were cut off by the shallow clone; their diffs would count the whole tree as added."""
    path = git_dir / "shallow"
    return set(path.read_text(encoding="utf-8").split()) if path.is_file() else set()


def _change(line: str) -> FileChange | None:
    parts = line.split("\t", 2)
    if len(parts) != 3:
        return None
    added, deleted, path = parts
    return FileChange(renamed_path(path), int(added) if added.isdigit() else 0, int(deleted) if deleted.isdigit() else 0)


def _utc_month(stamp: str) -> str:
    return month_key(datetime.fromisoformat(stamp).astimezone(timezone.utc).date())


def parse_log(text: str, shallow_roots: set[str] = frozenset()) -> list[Commit]:
    commits = []
    for entry in text.split(RECORD)[1:]:
        header, _, body = entry.partition("\n")
        sha, stamp, author, email, subject = header.split(UNIT, 4)
        changes = () if sha in shallow_roots else tuple(filter(None, (_change(line) for line in body.splitlines())))
        commits.append(Commit(sha=sha, month=_utc_month(stamp), author=author, email=email, subject=subject, changes=changes))
    return commits


def commits(git_dir: Path, ref: str, *, since: date, until: date, url: str) -> list[Commit]:
    """Non-merge commits on ``ref`` committed from ``since`` up to, not including, ``until`` (UTC days)."""
    args = [
        "log", ref, "--no-merges", "--numstat", "--find-renames", LOG_FORMAT,
        f"--since={since.isoformat()}T00:00:00Z", f"--until={until.isoformat()}T00:00:00Z",
    ]
    return parse_log(_git(git_dir, args, url=url, label="log"), _shallow_roots(git_dir))


def _commit_before(git_dir: Path, ref: str, moment: date, *, url: str) -> str | None:
    args = ["rev-list", "-1", "--first-parent", f"--before={moment.isoformat()}T00:00:00Z", ref]
    return _git(git_dir, args, url=url, label="rev-list").strip() or None


def _lines_at(git_dir: Path, sha: str, rules: dict[str, Any], *, url: str) -> int:
    pathspecs = [f"*.{extension}" for extension in rules["extensions"]]
    output = _git(git_dir, ["grep", "-c", "-I", "-e", "", sha, "--", *pathspecs], url=url, label="grep", ok=(0, 1))
    total = 0
    for line in output.splitlines():
        path, _, count = line.removeprefix(f"{sha}:").rpartition(":")
        if count.isdigit() and is_counted_python(path, rules):
            total += int(count)
    return total


def python_lines(git_dir: Path, ref: str, months: list[str], rules: dict[str, Any], *, url: str) -> dict[str, int | None]:
    """Counted Python lines on ``ref`` at the end of each month; ``None`` before the clone's history starts."""
    by_sha: dict[str, int] = {}
    lines: dict[str, int | None] = {}
    for month in months:
        sha = _commit_before(git_dir, ref, month_end(month), url=url)
        if sha is not None and sha not in by_sha:
            by_sha[sha] = _lines_at(git_dir, sha, rules, url=url)
        lines[month] = by_sha.get(sha) if sha else None
    return lines

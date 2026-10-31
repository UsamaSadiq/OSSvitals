import subprocess
from datetime import datetime, timezone
from pathlib import Path

import pytest

from collectors.fleet import patches
from collectors.fleet.collect import collect_clone_signals
from collectors.fleet.settings import load_settings

ENV = {"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t", "PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin"}
SERVE = ["uploadpack.allowFilter=true", "uploadpack.allowAnySHA1InWant=true"]


def git(*args, cwd):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True, env=ENV).stdout.strip()


def commit(repo: Path, name: str, text: str, message: str) -> str:
    (repo / name).write_text(text)
    git("add", name, cwd=repo)
    git("commit", "-m", message, cwd=repo)
    return git("rev-parse", "HEAD", cwd=repo)


@pytest.fixture
def fork_and_upstream(tmp_path):
    """Upstream gains a fix; our fork, which already carries a patch of its own, cherry-picks it."""
    upstream = tmp_path / "upstream"
    upstream.mkdir()
    git("init", "-b", "main", cwd=upstream)
    for setting in SERVE:
        git("config", *setting.split("="), cwd=upstream)
    commit(upstream, "app.txt", "one\n", "start")
    ours = tmp_path / "ours"
    git("clone", "-q", str(upstream), str(ours), cwd=tmp_path)
    for setting in SERVE:
        git("config", *setting.split("="), cwd=ours)
    git("checkout", "-q", "-b", "foss-main", cwd=ours)
    fix = commit(upstream, "fix.txt", "fixed\n", "Fix a crash")
    commit(upstream, "later.txt", "later\n", "Later upstream work")
    commit(ours, "sso.txt", "ours\n", "Add our sign-in")
    git("fetch", "-q", str(upstream), "main", cwd=ours)
    git("cherry-pick", fix, cwd=ours)
    clone = tmp_path / "clone.git"
    git("clone", "-q", "--bare", "--filter=blob:none", "--single-branch", "--branch", "foss-main", f"file://{ours}", str(clone), cwd=tmp_path)
    git("fetch", "-q", "--filter=blob:none", f"file://{upstream}", "+refs/heads/main:refs/fleet/upstream-head", cwd=clone)
    return clone, f"file://{ours}", f"file://{upstream}"


def test_a_cherry_picked_upstream_fix_is_already_upstream_and_our_own_patch_is_carried(fork_and_upstream):
    clone, ours, upstream = fork_and_upstream
    record = patches.carried(clone, "refs/heads/foss-main", "refs/fleet/upstream-head", ours, upstream, 1000)
    assert (record["compared"], record["commits"], record["carried"], record["already_upstream"]) == (True, 2, 1, 1)
    assert [item["subject"] for item in record["already_upstream_items"]] == ["Fix a crash"]
    assert [item["subject"] for item in record["carried_items"]] == ["Add our sign-in"]
    assert record["carried_items"][0]["date"]


def test_too_many_file_versions_lists_our_commits_without_comparing(fork_and_upstream):
    clone, ours, upstream = fork_and_upstream
    record = patches.carried(clone, "refs/heads/foss-main", "refs/fleet/upstream-head", ours, upstream, 0)
    assert (record["compared"], record["commits"], record["carried"], record["already_upstream"]) == (False, 2, None, None)
    assert len(record["carried_items"]) == 2


def test_a_failed_clone_fails_every_weekly_signal_of_that_fork_once():
    app = {"repo": "demo", "class": "fork", "upstream": "up/demo", "upstream_branch": "main"}
    calls = []

    def api(path):
        calls.append(path)
        return []

    records = collect_clone_signals(["conflicts", "carried_patches"], api, "Org", app, load_settings("moneta"), datetime(2026, 10, 31, tzinfo=timezone.utc))
    assert set(records) == {"conflicts", "carried_patches"}
    assert all(record["repo"] == "demo" and "error" in record for record in records.values())
    assert calls.count("repos/up/demo/releases?per_page=100") == 1

import subprocess
from datetime import datetime, timezone
from pathlib import Path

import pytest

from collectors.fleet import conflicts as fleet_conflicts
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
    commit(upstream, "old.txt", "line one\nline two\nline three\nline four\n", "Add a file to move later")
    ours = tmp_path / "ours"
    git("clone", "-q", str(upstream), str(ours), cwd=tmp_path)
    for setting in SERVE:
        git("config", *setting.split("="), cwd=ours)
    git("checkout", "-q", "-b", "foss-main", cwd=ours)
    fix = commit(upstream, "fix.txt", "fixed\n", "Fix a crash")
    git("mv", "old.txt", "new.txt", cwd=upstream)
    (upstream / "new.txt").write_text("line one\nline two\nline three\nline four\nline five\n")
    git("add", "new.txt", cwd=upstream)
    git("commit", "-m", "Move and extend a file", cwd=upstream)
    moved = git("rev-parse", "HEAD", cwd=upstream)
    commit(upstream, "later.txt", "later\n", "Later upstream work")
    commit(ours, "sso.txt", "ours\n", "Add our sign-in")
    git("fetch", "-q", str(upstream), "main", cwd=ours)
    git("cherry-pick", fix, cwd=ours)
    git("cherry-pick", moved, cwd=ours)
    commit(ours, "café.txt", "ours\n", "Add a file with an accented name")
    clone = tmp_path / "clone.git"
    git("clone", "-q", "--bare", "--filter=blob:none", "--single-branch", "--branch", "foss-main", f"file://{ours}", str(clone), cwd=tmp_path)
    git("fetch", "-q", "--filter=blob:none", f"file://{upstream}", "+refs/heads/main:refs/fleet/upstream-head", cwd=clone)
    return clone, f"file://{ours}", f"file://{upstream}"


def test_cherry_picked_upstream_changes_are_already_upstream_and_our_own_patches_are_carried(fork_and_upstream, monkeypatch):
    """Lazy fetching is forbidden, so the batched prefetch must cover renames and non-ASCII paths too."""
    clone, ours, upstream = fork_and_upstream
    monkeypatch.setenv("GIT_NO_LAZY_FETCH", "1")
    record = patches.carried(clone, "refs/heads/foss-main", "refs/fleet/upstream-head", ours, upstream, 1000)
    assert (record["compared"], record["commits"], record["carried"], record["already_upstream"]) == (True, 4, 2, 2)
    assert sorted(item["subject"] for item in record["already_upstream_items"]) == ["Fix a crash", "Move and extend a file"]
    assert sorted(item["subject"] for item in record["carried_items"]) == ["Add a file with an accented name", "Add our sign-in"]
    assert record["carried_items"][0]["date"]


def test_too_many_file_versions_lists_our_commits_without_comparing(fork_and_upstream):
    clone, ours, upstream = fork_and_upstream
    record = patches.carried(clone, "refs/heads/foss-main", "refs/fleet/upstream-head", ours, upstream, 0)
    assert (record["compared"], record["commits"], record["carried"], record["already_upstream"]) == (False, 4, None, None)
    assert len(record["carried_items"]) == 4


APP = {"repo": "demo", "class": "fork", "upstream": "up/demo", "upstream_branch": "main"}
NOW = datetime(2026, 10, 31, tzinfo=timezone.utc)


def test_a_failed_clone_fails_every_weekly_signal_of_that_fork_with_one_clone_attempt(monkeypatch):
    attempts = []

    def failing_clone(*args):
        attempts.append(args)
        raise RuntimeError("clone failed: no such repository")

    monkeypatch.setattr(fleet_conflicts, "prepare_clone", failing_clone)
    records = collect_clone_signals(["conflicts", "carried_patches"], lambda path: [], "Org", APP, load_settings("moneta"), NOW)
    assert {key: record["error"] for key, record in records.items()} == {
        "conflicts": "clone failed: no such repository",
        "carried_patches": "clone failed: no such repository",
    }
    assert len(attempts) == 1


def test_a_failed_release_lookup_fails_only_the_forecast(monkeypatch):
    monkeypatch.setattr(fleet_conflicts, "prepare_clone", lambda *args: None)
    monkeypatch.setattr(patches, "carried", lambda *args: {"compared": True, "commits": 0})

    def api(path):
        raise RuntimeError("releases unavailable")

    records = collect_clone_signals(["conflicts", "carried_patches"], api, "Org", APP, load_settings("moneta"), NOW)
    assert records["conflicts"]["error"] == "releases unavailable"
    assert records["carried_patches"] == {"repo": "demo", "compared": True, "commits": 0}


def test_a_bad_app_pattern_fails_that_fork_without_stopping_the_run():
    records = collect_clone_signals(["conflicts"], lambda path: [], "Org", {**APP, "release_tag": "^v(\\d+$"}, load_settings("moneta"), NOW)
    assert "error" in records["conflicts"]


@pytest.fixture
def merged_forward_with_submodule(tmp_path):
    """Upstream reaches a fix on main and merges a release branch that took two steps to the same content;
    both sides bump a submodule. Our fork has its own change to the same file."""
    library = tmp_path / "library"
    library.mkdir()
    git("init", "-b", "main", cwd=library)
    first = commit(library, "lib.txt", "1\n", "lib one")
    second = commit(library, "lib.txt", "2\n", "lib two")
    upstream = tmp_path / "upstream"
    upstream.mkdir()
    git("init", "-b", "main", cwd=upstream)
    for setting in SERVE:
        git("config", *setting.split("="), cwd=upstream)
    commit(upstream, "app.txt", "one\n", "start")
    git("update-index", "--add", "--cacheinfo", f"160000,{first},vendor/lib", cwd=upstream)
    git("commit", "-q", "-m", "add submodule", cwd=upstream)
    ours = tmp_path / "ours"
    git("clone", "-q", str(upstream), str(ours), cwd=tmp_path)
    for setting in SERVE:
        git("config", *setting.split("="), cwd=ours)
    git("checkout", "-q", "-b", "foss-main", cwd=ours)
    commit(ours, "app.txt", "ours\n", "Our change to the app")
    git("update-index", "--cacheinfo", f"160000,{second},vendor/lib", cwd=ours)
    git("commit", "-q", "-m", "Bump our library", cwd=ours)
    git("checkout", "-q", "-b", "release", cwd=upstream)
    commit(upstream, "app.txt", "half\n", "Side step one")
    commit(upstream, "app.txt", "fixed\n", "Side step two")
    git("checkout", "-q", "main", cwd=upstream)
    commit(upstream, "app.txt", "fixed\n", "Fix on main")
    git("merge", "-q", "--no-ff", "-m", "Merge release forward", "release", cwd=upstream)
    clone = tmp_path / "clone.git"
    git("clone", "-q", "--bare", "--filter=blob:none", "--single-branch", "--branch", "foss-main", f"file://{ours}", str(clone), cwd=tmp_path)
    git("fetch", "-q", "--filter=blob:none", f"file://{upstream}", "+refs/heads/main:refs/fleet/upstream-head", cwd=clone)
    return clone, f"file://{ours}", f"file://{upstream}"


def test_merged_side_branches_and_submodule_bumps_need_no_lazy_fetch(merged_forward_with_submodule, monkeypatch):
    clone, ours, upstream = merged_forward_with_submodule
    monkeypatch.setenv("GIT_NO_LAZY_FETCH", "1")
    record = patches.carried(clone, "refs/heads/foss-main", "refs/fleet/upstream-head", ours, upstream, 1000)
    assert (record["compared"], record["commits"], record["carried"], record["already_upstream"]) == (True, 2, 2, 0)


def test_git_errors_name_the_subcommand_not_its_options():
    assert patches._command(("-c", "fetch.negotiationAlgorithm=noop", "fetch", "--quiet")) == "fetch"
    assert patches._command(("--literal-pathspecs", "log")) == "log"

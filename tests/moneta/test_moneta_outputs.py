import subprocess
from pathlib import Path

import pytest

from collectors.moneta import badges, conflicts, history, versions

DRIFT = [
    {"repo": "a", "status": "critical", "behind_by": 4849, "ahead_by": 3, "advisories": {"since_fork_release": 2}, "fork_release": {"tag": "v26.1.0"}, "upstream_release": {"tag": "v2.0.0"}},
    {"repo": "b", "status": "in-sync", "behind_by": 0, "ahead_by": 1, "advisories": {"since_fork_release": 0}, "fork_release": None, "upstream_release": None},
    {"repo": "broken", "error": "x"},
]


def test_history_adds_one_row_per_healthy_fork():
    rows = history.append([], DRIFT, "2026-10-12", 90)
    assert [(row["date"], row["repo"], row["status"], row["behind_by"]) for row in rows] == [
        ("2026-10-12", "a", "critical", 4849),
        ("2026-10-12", "b", "in-sync", 0),
    ]


def test_history_is_idempotent_within_a_day_and_trims_old_rows():
    old = [{"date": "2026-01-01", "repo": "a"}, {"date": "2026-10-11", "repo": "a"}, {"date": "2026-10-12", "repo": "stale"}]
    rows = history.append(old, DRIFT, "2026-10-12", 90)
    assert [(row["date"], row["repo"]) for row in rows] == [("2026-10-11", "a"), ("2026-10-12", "a"), ("2026-10-12", "b")]


def test_badge_is_a_shields_endpoint_payload():
    assert badges.badge(DRIFT[0]) == {"schemaVersion": 1, "label": "upstream sync", "message": "critical (4,849 behind)", "color": "red"}
    assert badges.badge({**DRIFT[0], "status": "mystery"})["color"] == "lightgrey"


def test_versions_markdown_lists_latest_releases_and_never_says_deployed():
    apps = [{"repo": "B", "licence": "MIT", "latest_tag": "v1.0.0"}, {"repo": "a", "licence": None, "latest_tag": None}]
    text = versions.render(apps, DRIFT, "2026-10-12")
    assert "| a | v26.1.0 | v2.0.0 | – | critical |" in text
    assert "| B | v1.0.0 | – | MIT | – |" in text
    assert "not what any server is running" in text
    assert "deployed" not in text.lower()


def git(*args, cwd):
    env = {"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t", "PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin"}
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, env=env)


def commit_file(repo: Path, name: str, text: str):
    (repo / name).write_text(text)
    git("add", name, cwd=repo)
    git("commit", "-m", f"edit {name}", cwd=repo)


@pytest.fixture
def diverged_repo(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    git("init", "-b", "base", cwd=repo)
    commit_file(repo, "shared.txt", "one\ntwo\nthree\n")
    git("checkout", "-b", "ours", cwd=repo)
    commit_file(repo, "shared.txt", "one\nOURS\nthree\n")
    commit_file(repo, "ours_only.txt", "ours\n")
    git("checkout", "base", cwd=repo)
    git("checkout", "-b", "theirs", cwd=repo)
    commit_file(repo, "shared.txt", "one\nTHEIRS\nthree\n")
    git("checkout", "-b", "clean", "base", cwd=repo)
    commit_file(repo, "elsewhere.txt", "x\n")
    return repo


def test_forecast_names_the_files_that_would_conflict(diverged_repo):
    result = conflicts.forecast(diverged_repo, "ours", "theirs")
    assert result == {"clean": False, "conflicted_files": ["shared.txt"], "conflicted_total": 1}


def test_forecast_is_clean_when_upstream_touches_other_files(diverged_repo):
    result = conflicts.forecast(diverged_repo, "ours", "clean")
    assert result == {"clean": True, "conflicted_files": [], "conflicted_total": 0}


def test_forecast_reports_an_error_for_an_unknown_ref(diverged_repo):
    with pytest.raises(RuntimeError):
        conflicts.forecast(diverged_repo, "ours", "no-such-ref")


def test_merged_by_ranks_people_who_merged_and_skips_nobody_for_an_empty_history():
    from collectors.moneta import signals

    lookup = lambda owner, name, base: ["Zed", "amy", "amy", "Zed", "bob"]
    assert signals.merged_by(lookup, "o", "r", "main") == [{"login": "amy", "merged": 2}, {"login": "Zed", "merged": 2}, {"login": "bob", "merged": 1}]
    assert signals.merged_by(lambda *_: [], "o", "r", "main") == []
    assert signals.merged_by(lambda *_: None, "o", "r", "main") is None


def test_merged_by_logins_pages_through_every_merged_pull_request(monkeypatch):
    from collectors import github

    pages = {
        None: {"pageInfo": {"hasNextPage": True, "endCursor": "c1"}, "nodes": [{"mergedBy": {"login": "amy", "__typename": "User"}}, {"mergedBy": {"login": "bot", "__typename": "Bot"}}, {"mergedBy": None}]},
        "c1": {"pageInfo": {"hasNextPage": False, "endCursor": None}, "nodes": [{"mergedBy": {"login": "bob", "__typename": "User"}}]},
    }
    seen = []
    monkeypatch.setattr(github, "_merged_page", lambda owner, name, base, after: seen.append(after) or pages[after])
    assert github.merged_by_logins("o", "r", "main") == ["amy", "bob"]
    assert seen == [None, "c1"]


def test_merged_by_logins_is_unknown_when_the_repository_is_missing(monkeypatch):
    from collectors import github

    monkeypatch.setattr(github, "_merged_page", lambda *_: None)
    assert github.merged_by_logins("o", "r", "main") is None

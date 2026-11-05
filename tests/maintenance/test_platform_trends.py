"""Stability trends of a monolith from its git history."""
from __future__ import annotations

import json
import os
import subprocess
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from collectors import platform_history, platform_trends
from collectors.platform_trends import Commit, FileChange
from dashboard.lib.config import get_config
from scripts import check_freshness, collect_maintenance

URL = "https://github.com/acme/monolith.git"


@pytest.fixture(scope="module")
def config() -> dict:
    return get_config("platform_trends", "openedx")


@pytest.fixture(scope="module")
def rules(config) -> dict:
    return {"python": config["python"], "mechanical": config["mechanical"], "bot_pattern": config["bot_pattern"]}


def commit(month: str, email: str, *paths: str, author: str = "Dev", subject: str = "feat: x", added: int = 10) -> Commit:
    return Commit(
        sha=f"{month}-{email}-{subject}",
        month=month,
        author=author,
        email=email,
        subject=subject,
        changes=tuple(FileChange(path, added, 1) for path in paths),
    )


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("lms/views.py", "lms/views.py"),
        ("common/lib/xmodule/{xmodule => }/capa.py", "common/lib/xmodule/capa.py"),
        ("{common/lib => }/xmodule/x.py", "xmodule/x.py"),
        ("old.py => new.py", "new.py"),
    ],
)
def test_renamed_path_is_the_new_path(raw, expected):
    assert platform_trends.renamed_path(raw) == expected


@pytest.mark.parametrize(
    ("path", "counted"),
    [
        ("lms/djangoapps/courseware/views.py", True),
        ("lms/djangoapps/courseware/tests/test_views.py", False),
        ("common/test/utils.py", False),
        ("openedx/core/test_utils.py", False),
        ("cms/djangoapps/x/views_tests.py", False),
        ("conftest.py", False),
        ("lms/djangoapps/grades/migrations/0001_initial.py", False),
        ("lms/static/js/app.js", False),
        ("Makefile", False),
    ],
)
def test_counted_python_skips_tests_and_migrations(config, path, counted):
    assert platform_trends.is_counted_python(path, config["python"]) is counted


def test_sweeps_lint_changes_and_bots_are_set_apart(rules):
    sweep = commit("2025-01", "a@axim.org", *(f"f{index}.py" for index in range(501)))
    lint = commit("2025-01", "a@axim.org", "a.py", subject="fix: apply ruff isort auto-fixes")
    style = commit("2025-01", "a@axim.org", "a.py", subject="style: reformat")
    bot = commit("2025-01", "41898282+github-actions[bot]@users.noreply.github.com", "a.py", author="github-actions[bot]")
    requirements = commit("2025-01", "devops+edx-requirements-bot@edx.org", "a.py", author="edX requirements bot")
    real = commit("2025-01", "b@arbisoft.com", "lms/views.py", "lms/tests/test_views.py")

    by_month, _ = platform_trends.tallies([sweep, lint, style, bot, requirements, real], ["2025-01"], rules)

    assert by_month["2025-01"].counts() == {
        "commits": 1,
        "authors": 1,
        "python_added": 10,
        "python_deleted": 1,
        "bot_commits": 2,
        "mechanical_commits": 3,
    }


def test_a_year_counts_distinct_authors_not_the_sum_of_its_months(rules):
    history = [
        commit("2025-01", "a@axim.org", "a.py"),
        commit("2025-02", "A@axim.org", "a.py"),
        commit("2025-02", "b@axim.org", "a.py"),
        commit("2024-12", "c@axim.org", "a.py"),
    ]

    by_month, by_year = platform_trends.tallies(history, ["2025-01", "2025-02"], rules)

    assert [by_month[month].counts()["authors"] for month in ("2025-01", "2025-02")] == [1, 2]
    assert by_year["2025"].counts()["authors"] == 2 and by_year["2025"].commits == 3
    assert "2024" not in by_year


@pytest.mark.parametrize(
    ("email", "bucket"),
    [
        ("dev@Arbisoft.com", "arbisoft.com"),
        ("123+dev@users.noreply.github.com", platform_trends.NOREPLY),
        ("dev@gmail.com", platform_trends.PERSONAL),
        ("dev@A006-01130.local", platform_trends.UNKNOWN),
        ("dev@localhost", platform_trends.UNKNOWN),
        ("no-at-sign", platform_trends.UNKNOWN),
    ],
)
def test_email_bucket(config, email, bucket):
    assert platform_trends.email_bucket(email, config["organisations"]["personal_domains"]) == bucket


def test_organisations_fold_small_and_trailing_domains(rules):
    emails = ["a@big.org", "b@big.org", "c@big.org", "d@mid.org", "e@mid.org", "f@low.org", "g@low.org", "solo@person.dev"]
    history = [commit("2025-01", email, "a.py") for email in [*emails, "x@gmail.com", "1+y@users.noreply.github.com"]]
    _, by_year = platform_trends.tallies(history, ["2025-01"], rules)

    rows = platform_trends.organisations(by_year["2025"], {"top": 2, "min_authors": 2, "personal_domains": ["gmail.com"]})

    assert [(row["name"], row["authors"]) for row in rows] == [
        ("big.org", 3),
        ("low.org", 2),
        ("other", 3),
        ("noreply", 1),
        ("personal", 1),
    ]
    assert rows[2]["domains"] == 2
    assert "person.dev" not in json.dumps(rows)


def test_year_records_mark_partial_years(rules):
    months = platform_trends.months_between("2023-07", "2025-02")
    by_month, by_year = platform_trends.tallies([commit("2024-03", "a@axim.org", "a.py")], months, rules)
    lines = {"2023-12": 100, "2024-12": 120, "2025-02": 125}

    years = platform_trends.year_records(
        by_year, lines, since=months[0], through="2025-02", organisation_rules={"top": 5, "min_authors": 2}
    )

    assert [(row["year"], row["complete"], row["through"], row["python_lines"]) for row in years] == [
        (2023, False, "2023-12", 100),
        (2024, True, "2024-12", 120),
        (2025, False, "2025-02", 125),
    ]
    assert platform_trends.summary(years) == {
        "first_year": 2024,
        "latest_year": 2024,
        "first": {"commits": 1, "authors": 1, "python_lines": 120},
        "latest": {"commits": 1, "authors": 1, "python_lines": 120},
    }
    assert len(platform_trends.month_records(by_month, lines)) == len(months)


def test_summary_without_a_complete_year_is_empty():
    assert platform_trends.summary([{"year": 2025, "complete": False}]) == {}


def test_month_helpers_cross_year_boundaries():
    assert platform_trends.months_between("2024-11", "2025-02") == ["2024-11", "2024-12", "2025-01", "2025-02"]
    assert platform_trends.previous_month(date(2026, 1, 15)) == "2025-12"
    assert platform_trends.month_end("2025-12") == date(2026, 1, 1)


def test_parse_log_drops_changes_of_shallow_roots():
    text = (
        "\x1eaaa\x1f2025-01-31T23:30:00-05:00\x1fDev\x1fd@x.org\x1ffeat: a\n\n3\t1\tlms/a.py\n-\t-\timg.png\n"
        "\x1ebbb\x1f2025-01-02T10:00:00+00:00\x1fDev\x1fd@x.org\x1ffeat: b\n\n900\t0\tlms/b.py\n"
    )

    first, second = platform_history.parse_log(text, {"bbb"})

    assert first.month == "2025-02"
    assert first.changes == (FileChange("lms/a.py", 3, 1), FileChange("img.png", 0, 0))
    assert second.changes == ()


def _git(repo: Path, *args: str, when: str | None = None) -> None:
    env = {**os.environ, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1"}
    if when:
        env |= {"GIT_AUTHOR_DATE": when, "GIT_COMMITTER_DATE": when}
    subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True, env=env)


def _commit(repo: Path, when: str, email: str, files: dict[str, str], message: str) -> None:
    for name, text in files.items():
        path = repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    _git(repo, "add", "-A")
    _git(repo, "-c", "user.name=Dev", "-c", f"user.email={email}", "commit", "-q", "-m", message, when=when)


@pytest.fixture
def monolith(tmp_path) -> Path:
    repo = tmp_path / "monolith"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "master")
    _commit(repo, "2024-12-20T10:00:00Z", "a@axim.org", {"lms/views.py": "a\nb\n"}, "feat: start")
    _commit(repo, "2025-01-10T10:00:00Z", "b@arbisoft.com", {"lms/views.py": "a\nb\nc\n", "lms/tests/test_views.py": "t\n"}, "feat: grow")
    _git(repo, "mv", "lms/views.py", "lms/pages.py")
    _git(repo, "-c", "user.name=Dev", "-c", "user.email=b@arbisoft.com", "commit", "-q", "-m", "refactor: rename", when="2025-01-20T10:00:00Z")
    _commit(repo, "2025-02-05T10:00:00Z", "c@axim.org", {"cms/new.py": "x\ny\nz\nw\n"}, "feat: cms")
    return repo / ".git"


def test_history_reads_commits_and_month_end_lines(monolith, config):
    history = platform_history.commits(monolith, "master", since=date(2025, 1, 1), until=date(2025, 3, 1), url=URL)
    lines = platform_history.python_lines(monolith, "master", ["2024-11", "2024-12", "2025-01", "2025-02"], config["python"], url=URL)

    assert [item.subject for item in history] == ["feat: cms", "refactor: rename", "feat: grow"]
    renamed = next(item for item in history if item.subject == "refactor: rename")
    assert renamed.changes == (FileChange("lms/pages.py", 0, 0),)
    assert lines == {"2024-11": None, "2024-12": 2, "2025-01": 3, "2025-02": 7}
    assert len(platform_history.head(monolith, "master", url=URL)) == 40


def test_collector_keeps_a_file_that_is_already_through_last_month(tmp_path, monkeypatch, config):
    monkeypatch.setattr(collect_maintenance, "now_utc", lambda: datetime(2026, 11, 5, tzinfo=timezone.utc))
    path = tmp_path / collect_maintenance.PLATFORM_TRENDS_FILE
    path.write_text(json.dumps({"metadata": {"through": "2026-10", "settings": config}, "records": []}), encoding="utf-8")
    monkeypatch.setattr(collect_maintenance, "_read_history", lambda *args: pytest.fail("should not clone"))

    assert collect_maintenance.collect_platform_trends(tmp_path, scope=None, target=collect_maintenance.Target("openedx", "openedx")) == 0
    assert json.loads(path.read_text(encoding="utf-8"))["metadata"]["through"] == "2026-10"


def test_collector_recollects_when_settings_change(config):
    assert not collect_maintenance.is_current({"through": "2026-10", "settings": {**config, "since": "2021-01"}}, through="2026-10", config=config)
    assert not collect_maintenance.is_current({"through": "2026-09", "settings": config}, through="2026-10", config=config)
    assert not collect_maintenance.is_current({}, through="2026-10", config=config)


def test_collector_failure_keeps_the_published_file(tmp_path, monkeypatch, capsys):
    path = tmp_path / collect_maintenance.PLATFORM_TRENDS_FILE
    path.write_text('{"metadata": {"through": "2020-01"}, "records": []}', encoding="utf-8")

    def fail(*args):
        raise platform_history.HistoryError("clone failed with exit code 128")

    monkeypatch.setattr(collect_maintenance, "_read_history", fail)

    assert collect_maintenance.collect_platform_trends(tmp_path, scope=None, target=collect_maintenance.Target("openedx", "openedx")) == 0
    assert "kept the published file" in capsys.readouterr().out
    assert json.loads(path.read_text(encoding="utf-8"))["metadata"]["through"] == "2020-01"


def test_collector_writes_months_years_and_summary(tmp_path, monkeypatch, monolith):
    monkeypatch.setattr(collect_maintenance, "now_utc", lambda: datetime(2025, 3, 2, tzinfo=timezone.utc))
    monkeypatch.setattr(collect_maintenance, "get_config", lambda section, org: {**get_config(section, org), "since": "2024-12"})

    def local_history(config, months):
        history = platform_history.commits(monolith, "master", since=date(2024, 12, 1), until=date(2025, 3, 1), url=URL)
        return "abc", history, platform_history.python_lines(monolith, "master", months, config["python"], url=URL)

    monkeypatch.setattr(collect_maintenance, "_read_history", local_history)

    assert collect_maintenance.collect_platform_trends(tmp_path, scope=None, target=collect_maintenance.Target("openedx", "openedx")) == 0
    published = json.loads((tmp_path / collect_maintenance.PLATFORM_TRENDS_FILE).read_text(encoding="utf-8"))
    meta = published["metadata"]
    assert (meta["since"], meta["through"], meta["head"]) == ("2024-12", "2025-02", "abc")
    assert [row["month"] for row in published["records"]] == ["2024-12", "2025-01", "2025-02"]
    assert [(row["year"], row["commits"], row["python_lines"]) for row in meta["years"]] == [(2024, 1, 2), (2025, 3, 7)]


def test_monthly_files_get_a_longer_freshness_limit():
    assert check_freshness.max_age_days("platform_trends.json") == 38
    assert check_freshness.max_age_days("modularization.json") == check_freshness.DEFAULT_MAX_AGE_DAYS


def test_clone_failure_reports_git_stderr_without_urls_or_tokens(tmp_path, monkeypatch, capsys):
    token = "ghp_" + "b" * 36
    stderr = f"remote: counting\nfatal: unable to access 'https://x:{token}@github.com/o/r.git/': RPC failed\n"
    monkeypatch.setattr(platform_history, "run_git", lambda *a, **k: subprocess.CompletedProcess([], 128, "", stderr))
    monkeypatch.setattr(collect_maintenance, "now_utc", lambda: datetime(2026, 11, 5, tzinfo=timezone.utc))

    assert collect_maintenance.collect_platform_trends(tmp_path, scope=None, target=collect_maintenance.Target("openedx", "openedx")) == 0
    out = capsys.readouterr().out
    assert "clone failed with exit code 128: fatal: unable to access" in out and "RPC failed" in out
    assert token not in out and "github.com" not in out
    assert not (tmp_path / collect_maintenance.PLATFORM_TRENDS_FILE).exists()

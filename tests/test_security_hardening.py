from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import pytest

from collectors import github, publish
from collectors.fleet import conflicts
from collectors.fleet.errors import public_message
from collectors.fleet.git_env import git_env
from dashboard.lib.redaction import compile_patterns, redact

SECRET = "ghp_" + "a" * 36


def completed(returncode: int = 0, stdout: str = "", stderr: str = "") -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess([], returncode, stdout, stderr)


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr(github.time, "sleep", lambda seconds: None)


def test_redact_applies_patterns_to_keys():
    patterns = compile_patterns({"patterns": ["client-a"]})
    assert redact({"client-a/repo": {"client-a": 1}}, patterns) == {"[redacted]/repo": {"[redacted]": 1}}


def test_redact_keeps_colliding_keys_apart():
    patterns = compile_patterns({"patterns": [r"\d+"]})
    result = redact({"x1": 1, "x2": 2}, patterns, "N")
    assert sorted(result.values()) == [1, 2]
    assert len(result) == 2


def test_publish_write_applies_org_patterns(tmp_path, monkeypatch):
    monkeypatch.setattr("dashboard.lib.redaction.get_config", lambda section, org: {"patterns": ["secret-branch"], "replacement": "X"})
    target = tmp_path / "out.json"
    publish.write(target, {"records": [{"branch": "secret-branch"}], "secret-branch": 1}, org="acme")
    text = target.read_text(encoding="utf-8")
    assert "secret-branch" not in text
    assert json.loads(text)["records"][0]["branch"] == "X"


def test_collector_publish_redacts_with_the_collected_tenant(tmp_path, monkeypatch):
    from datetime import datetime, timezone

    from scripts import collect_maintenance

    orgs: list[str | None] = []
    monkeypatch.setattr("dashboard.lib.redaction.get_config", lambda section, org: orgs.append(org) or {})
    collect_maintenance._publish(
        tmp_path / "out.json",
        [{"repo": "a"}],
        scope=collect_maintenance.Scope(repos=[], merge=False),
        target=collect_maintenance.Target(org="acme", github_org="acme-gh"),
        generated_at=datetime(2026, 11, 5, tzinfo=timezone.utc),
        order=lambda records: records,
        source="s",
    )
    assert orgs == ["acme"]


def test_publish_write_without_patterns_keeps_content(tmp_path):
    target = tmp_path / "out.json"
    publish.write(target, {"records": [{"branch": "main"}]}, org="openedx")
    assert json.loads(target.read_text(encoding="utf-8"))["records"] == [{"branch": "main"}]


def test_public_message_strips_urls_tokens_and_truncates():
    error = RuntimeError(f"clone failed: fatal: unable to access 'https://user:{SECRET}@github.com/o/r.git/': nope\nsecond line")
    message = public_message(error)
    assert "github.com" not in message and SECRET not in message and "second" not in message
    assert len(public_message(RuntimeError("x" * 1000))) == 200


def test_clone_failure_error_is_not_raw_stderr(monkeypatch, tmp_path):
    stderr = f"fatal: could not read from 'https://github.com/o/private.git' {SECRET}"
    monkeypatch.setattr(conflicts, "run_git", lambda *a, **k: completed(128, stderr=stderr))
    with pytest.raises(RuntimeError) as raised:
        conflicts.prepare_clone(tmp_path / "c", "https://github.com/o/private.git", "main", "https://github.com/u/r.git", "main", None)
    assert "github.com" not in public_message(raised.value)


def test_git_timeout_becomes_runtime_error(monkeypatch, tmp_path):
    def boom(*args, **kwargs):
        raise subprocess.TimeoutExpired("git", 1)

    monkeypatch.setattr("collectors.fleet.git_env.subprocess.run", boom)
    with pytest.raises(RuntimeError, match="took over"):
        conflicts.forecast(tmp_path, "a", "b")


def test_git_env_routes_owner_token_without_argv(monkeypatch):
    monkeypatch.setenv(github.OWNER_TOKENS_ENV, json.dumps({"Acme": "tok"}))
    env = git_env("https://github.com/acme/repo.git", {})
    assert env["GIT_CONFIG_COUNT"] == "1"
    assert env["GIT_CONFIG_KEY_0"] == "http.https://github.com/acme/.extraheader"
    assert env["GIT_CONFIG_VALUE_0"].startswith("Authorization: basic ")


def test_git_env_unknown_owner_adds_no_config(monkeypatch):
    monkeypatch.setenv(github.OWNER_TOKENS_ENV, json.dumps({"acme": "tok"}))
    assert "GIT_CONFIG_COUNT" not in git_env("https://github.com/other/repo.git", {})


def test_git_env_appends_after_existing_config(monkeypatch):
    monkeypatch.setenv(github.OWNER_TOKENS_ENV, json.dumps({"acme": "tok"}))
    env = git_env("https://github.com/acme/r.git", {"GIT_CONFIG_COUNT": "2"})
    assert env["GIT_CONFIG_COUNT"] == "3" and "GIT_CONFIG_KEY_2" in env


def test_file_content_quotes_segments(monkeypatch):
    seen = []
    monkeypatch.setattr(github, "_gh_optional", lambda *args: seen.append(args) or "x")
    github.file_content("o/r", "a b/c?d#e", "x&y/z")
    assert seen[0][1] == "repos/o/r/contents/a%20b/c%3Fd%23e?ref=x%26y%2Fz"


def test_owner_tokens_parsed_once(monkeypatch):
    github._parsed_owner_tokens.cache_clear()
    calls = []
    real = json.loads
    monkeypatch.setattr(github.json, "loads", lambda raw: calls.append(raw) or real(raw))
    for _ in range(3):
        github.owner_tokens('{"A": "t"}')
    assert len(calls) == 1


@pytest.mark.parametrize("stderr", ["gh: Validation Failed (HTTP 422)", "gh: Forbidden (HTTP 403)", "gh: Gone (HTTP 410)"])
def test_gh_json_does_not_retry_client_errors(monkeypatch, stderr):
    calls = []
    monkeypatch.setattr(github, "_attempt", lambda args: calls.append(args) or completed(1, stderr=stderr))
    with pytest.raises(RuntimeError):
        github.gh_json("api", "x")
    assert len(calls) == 1


@pytest.mark.parametrize("stderr", ["HTTP 403: API rate limit exceeded", "HTTP 403: You have exceeded a secondary rate limit", "HTTP 429", "HTTP 502", "connection reset"])
def test_gh_json_retries_transient_errors(monkeypatch, stderr):
    calls = []
    monkeypatch.setattr(github, "_attempt", lambda args: calls.append(args) or completed(1, stderr=stderr))
    with pytest.raises(RuntimeError):
        github.gh_json("api", "x")
    assert len(calls) == github.RETRIES


def test_gh_timeout_is_retried_then_raises(monkeypatch):
    calls = []

    def boom(*args, **kwargs):
        calls.append(1)
        raise subprocess.TimeoutExpired("gh", 1)

    monkeypatch.setattr(github.subprocess, "run", boom)
    with pytest.raises(RuntimeError, match="timed out"):
        github.gh_json("api", "x")
    assert len(calls) == github.RETRIES

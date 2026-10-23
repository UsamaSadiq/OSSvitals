"""Repo-scoped runs fold into the published file without touching other repos or the full-run stamp."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from collectors import merge, publish
from scripts.collect_maintenance import Scope, Target, _publish

FULL_RUN = datetime(2026, 10, 22, 8, 53, tzinfo=timezone.utc)
PARTIAL_RUN = datetime(2026, 10, 23, 6, 4, tzinfo=timezone.utc)
TARGET = Target(org="openedx", github_org="openedx")


def _record(repo: str, status: str) -> dict:
    return {"repo_name": f"openedx/{repo}", "status": status}


def _by_name(records: list[dict]) -> list[dict]:
    return sorted(records, key=lambda record: record["repo_name"])


def _count(records: list[dict]) -> dict:
    return {"done": sum(record["status"] == "done" for record in records)}


def _published(tmp_path, records, **metadata):
    path = tmp_path / "wave.json"
    publish.write(path, publish.payload(records, generated_at=FULL_RUN, source="s", **metadata))
    return path


def test_records_replace_only_the_refreshed_repos():
    existing = [_record("a", "not_started"), _record("b", "not_started")]
    merged = merge.records(existing, [_record("b", "done")], {"openedx/b"})
    assert merged == [_record("a", "not_started"), _record("b", "done")]


def test_records_drop_a_refreshed_repo_that_came_back_empty():
    existing = [_record("a", "pr_open"), _record("b", "pr_open")]
    assert merge.records(existing, [], {"openedx/b"}) == [_record("a", "pr_open")]


def test_payload_keeps_the_full_run_stamp_and_records_the_partial_run():
    existing = publish.payload([], generated_at=FULL_RUN, source="s", bot_prs_checked=40)
    content = merge.payload(existing, [], refreshed_at=PARTIAL_RUN, refreshed={"openedx/b", "openedx/a"}, redundant=0)
    assert content["metadata"]["generated_at"] == FULL_RUN.isoformat()
    assert content["metadata"]["bot_prs_checked"] == 40
    assert content["metadata"]["redundant"] == 0
    assert content["metadata"]["refreshed_at"] == PARTIAL_RUN.isoformat()
    assert content["metadata"]["refreshed_repos"] == ["openedx/a", "openedx/b"]


def test_publish_merge_recomputes_derived_fields_over_every_repo(tmp_path):
    path = _published(tmp_path, [_record("a", "done"), _record("b", "not_started")], summary={"done": 1})
    _publish(
        path,
        [_record("b", "done")],
        scope=Scope(repos=["b"], merge=True),
        target=TARGET,
        generated_at=PARTIAL_RUN,
        order=_by_name,
        derive=lambda records: {"summary": _count(records)},
        source="s",
    )
    content = json.loads(path.read_text(encoding="utf-8"))
    assert content["records"] == [_record("a", "done"), _record("b", "done")]
    assert content["metadata"]["summary"] == {"done": 2}
    assert content["metadata"]["generated_at"] == FULL_RUN.isoformat()


def test_publish_merge_keeps_full_run_only_fields(tmp_path):
    path = _published(tmp_path, [], candidates=12)
    _publish(
        path,
        [],
        scope=Scope(repos=["b"], merge=True),
        target=TARGET,
        generated_at=PARTIAL_RUN,
        order=_by_name,
        full_run={"candidates": 1},
        source="s",
    )
    assert json.loads(path.read_text(encoding="utf-8"))["metadata"]["candidates"] == 12


def test_publish_merge_skips_a_file_that_was_never_published(tmp_path):
    path = tmp_path / "missing.json"
    result = _publish(
        path, [_record("b", "done")], scope=Scope(repos=["b"], merge=True), target=TARGET,
        generated_at=PARTIAL_RUN, order=_by_name, source="s",
    )
    assert result is None
    assert not path.exists()


def test_publish_without_merge_replaces_the_file(tmp_path):
    path = _published(tmp_path, [_record("a", "done")])
    _publish(
        path, [_record("b", "done")], scope=Scope(repos=["b"], merge=False), target=TARGET,
        generated_at=PARTIAL_RUN, order=_by_name, source="s",
    )
    content = json.loads(path.read_text(encoding="utf-8"))
    assert content["records"] == [_record("b", "done")]
    assert content["metadata"]["generated_at"] == PARTIAL_RUN.isoformat()
    assert "refreshed_at" not in content["metadata"]


def test_merge_run_for_an_unlisted_repo_drops_its_stale_record(tmp_path, monkeypatch):
    from scripts import collect_maintenance

    wave = {"title": "t", "pull_requests": {"search_terms": [], "title_regex": "x"}}
    monkeypatch.setattr(collect_maintenance.github, "org_repos", lambda org: [])
    monkeypatch.setattr(collect_maintenance, "get_config", lambda name, org: {"waves": {"w": wave}})
    path = tmp_path / "waves" / "w.json"
    records = [{**_record(repo, "done"), "pr_age_days": None} for repo in ("a", "gone")]
    publish.write(path, publish.payload(records, generated_at=FULL_RUN, source="s"))

    result = collect_maintenance.collect_waves(tmp_path, Scope(repos=["gone"], merge=True), TARGET)

    assert result == 0
    assert [record["repo_name"] for record in json.loads(path.read_text(encoding="utf-8"))["records"]] == ["openedx/a"]

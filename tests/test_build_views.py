from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pytest

from dashboard.lib import config, fixtures
from dashboard.lib.pipeline import score_org
from dashboard.lib.redaction import compile_patterns, redact
from dashboard.lib.scores_export import build_snapshot_payload
from dashboard.lib.views_export import BUILDERS, BuildContext, write_views

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "data"
GENERATED_AT = datetime(2026, 9, 1, tzinfo=timezone.utc)


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    with pytest.MonkeyPatch.context() as mp:
        mp.setenv(fixtures.FIXTURE_DIR_ENV, str(FIXTURE_DIR))
        data = score_org()
        out_dir = tmp_path_factory.mktemp("views")
        write_views(BuildContext(data=data, generated_at=GENERATED_AT), out_dir)
    files = {path.name: json.loads(path.read_text(encoding="utf-8")) for path in out_dir.iterdir()}
    return data, files


def test_writes_every_view_file(built):
    _, files = built
    assert set(files) == set(BUILDERS)


def test_every_file_carries_the_envelope(built):
    _, files = built
    for name, payload in files.items():
        meta = payload["metadata"]
        assert meta["org"] == "openedx", name
        assert meta["schema_version"] == 1, name
        assert meta["generated_at"] == GENERATED_AT.isoformat(), name
        assert meta["snapshot_timestamp"] == "2026-08-31", name


def test_repos_match_published_scores(built):
    data, files = built
    scores = build_snapshot_payload(data.scored, generated_at=GENERATED_AT, source_url="")["records"]
    repos = files["repos.json"]["records"]
    assert [r["repo_name"] for r in repos] == [r["repo_name"] for r in scores]
    assert [r["score_composite"] for r in repos] == [r["score_composite"] for r in scores]


def test_repo_checks_are_classified_and_exclude_non_checks(built):
    _, files = built
    checks = files["repos.json"]["records"][0]["checks"]
    assert set(checks.values()) <= {"pass", "fail", "unknown"}
    assert not any(name.startswith(("github.", "language_bytes.", "ownership.")) for name in checks)


def test_page_lists_only_known_repos(built):
    _, files = built
    known = {r["repo_name"] for r in files["repos.json"]["records"]}
    for name in ("attention.json", "at_risk.json"):
        assert {r["repo_name"] for r in files[name]["records"]} <= known, name


def test_history_is_compact(built):
    _, files = built
    history = files["history.json"]
    assert history["dates"] == sorted(history["dates"])
    assert len(history["org_average"]) == len(history["dates"])
    stamp, composite, letter = next(iter(history["repos"].values()))[0]
    assert stamp in history["dates"] and isinstance(composite, float) and letter in "ABCDF"


def test_overview_and_what_changed_use_history_windows(built):
    _, files = built
    overview, changed = files["overview.json"], files["what_changed.json"]
    assert overview["kpi_baseline_date"] == "2026-08-25"
    assert overview["movers_from"] == "2026-08-16"
    assert (changed["previous"], changed["latest"]) == ("2026-08-25", "2026-08-31")


def test_at_risk_applies_like_for_like_deltas(built):
    _, files = built
    at_risk = files["at_risk.json"]
    assert at_risk["enabled"] is True
    assert "pr_response_time" in at_risk["skipped_metrics"]
    assert all(isinstance(r["production_or_release"], bool) for r in at_risk["records"])


def test_scoring_includes_proposed_comparison(built):
    _, files = built
    proposed = files["scoring.json"]["proposed"]
    total = sum(sum(row.values()) for row in proposed["migration"].values())
    assert total == len(files["repos.json"]["records"])


def test_redact_replaces_matches_in_values_only():
    patterns = compile_patterns({"patterns": [r"client-\w+"]})
    payload = {"client-a": ["release/client-acme", {"tag": "v1-client-beta"}], "n": 3}
    assert redact(payload, patterns) == {"client-a": ["release/[redacted]", {"tag": "v1-[redacted]"}], "n": 3}


def test_redact_without_patterns_returns_input():
    payload = {"branch": "release/client-acme"}
    assert redact(payload, []) is payload


def test_write_views_applies_org_redaction(built, tmp_path, monkeypatch):
    data, _ = built
    real = config.get_config
    monkeypatch.setattr(
        "dashboard.lib.views_export.get_config",
        lambda section, org: {"patterns": [re.escape("openedx/")], "replacement": ""} if section == "redact" else real(section, org),
    )
    write_views(BuildContext(data=data, generated_at=GENERATED_AT), tmp_path)
    repos = json.loads((tmp_path / "repos.json").read_text(encoding="utf-8"))["records"]
    assert not any(r["repo_name"].startswith("openedx/") for r in repos)

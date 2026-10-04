from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pytest

from dashboard.lib import config, fixtures
from dashboard.lib.pipeline import score_org
from dashboard.lib.redaction import compile_patterns, redact
from dashboard.lib.scores_export import build_snapshot_payload
from dashboard.lib.views_export import BUILDERS, BuildContext, gainers_and_losers, highlights, kpi_deltas, write_views
from dashboard.lib.views_maintenance import load_maintenance_dir

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "data"
GENERATED_AT = datetime(2026, 9, 1, tzinfo=timezone.utc)


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    with pytest.MonkeyPatch.context() as mp:
        mp.setenv(fixtures.FIXTURE_DIR_ENV, str(FIXTURE_DIR))
        data = score_org()
        out_dir = tmp_path_factory.mktemp("views")
        maintenance = load_maintenance_dir(FIXTURE_DIR / "maintenance", config.get_config("waves").get("waves", {}))
        write_views(BuildContext(data=data, generated_at=GENERATED_AT, maintenance=maintenance), out_dir)
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


def test_overview_grades_the_org_average_with_scoring_config(built):
    _, files = built
    overview = files["overview.json"]
    assert overview["kpis"]["avg_composite"] == pytest.approx(71.459, abs=1e-3)
    assert overview["avg_letter"] == "B"


def test_overview_kpi_deltas_subtract_the_baseline(built):
    _, files = built
    overview = files["overview.json"]
    kpis, baseline, deltas = overview["kpis"], overview["kpi_baseline"], overview["kpi_deltas"]
    assert set(deltas) == {"repos", "avg_composite", "grade_a", "grade_f", "stale"}
    assert deltas["avg_composite"] == pytest.approx(kpis["avg_composite"] - baseline["avg_composite"])
    for field in ("repos", "grade_a", "grade_f", "stale"):
        assert deltas[field] == kpis[field] - baseline[field]
        assert isinstance(deltas[field], int)
    assert (deltas["repos"], deltas["grade_a"], deltas["grade_f"]) == (-2, 3, 0)


def test_kpi_deltas_are_null_without_baseline():
    assert kpi_deltas({"repos": 3}, None) is None


def test_overview_highlights_rank_with_alphabetical_tiebreak(built):
    _, files = built
    top, bottom = files["overview.json"]["highlights"]["top"], files["overview.json"]["highlights"]["bottom"]
    assert len(top) == len(bottom) == 5
    assert set(top[0]) == {"repo_name", "score_composite", "score_letter"}
    assert [r["repo_name"] for r in top[-2:]] == ["openedx/XBlock", "openedx/openedx-filters"]
    assert [r["score_composite"] for r in top] == sorted((r["score_composite"] for r in top), reverse=True)
    assert [r["score_composite"] for r in bottom] == sorted(r["score_composite"] for r in bottom)
    assert bottom[0]["score_composite"] == min(r["score_composite"] for r in files["repos.json"]["records"])


def test_overview_gainers_and_losers_split_movers_by_sign(built):
    _, files = built
    overview = files["overview.json"]
    gainers, losers = overview["gainers"], overview["losers"]
    assert len(gainers) == len(losers) == 5
    assert set(gainers[0]) == {"repo_name", "score_composite", "baseline_score", "delta"}
    assert all(r["delta"] > 0 for r in gainers) and all(r["delta"] < 0 for r in losers)
    assert gainers[0]["delta"] == max(r["delta"] for r in overview["movers"])
    assert losers[0]["delta"] == min(r["delta"] for r in overview["movers"])
    assert [r["repo_name"] for r in losers[:2]] == sorted(r["repo_name"] for r in losers[:2])


def test_gainers_and_losers_never_relabel_gains_as_losses():
    movers = pd.DataFrame({"repo_name": ["a", "b"], "score_composite": [60.0, 70.0], "baseline_score": [50.0, 65.0], "delta": [10.0, 5.0]})
    gainers, losers = gainers_and_losers(movers)
    assert [r["repo_name"] for r in gainers] == ["a", "b"]
    assert losers == []


def test_empty_inputs_give_empty_highlights_and_movers():
    assert highlights(pd.DataFrame()) == {"top": [], "bottom": []}
    assert gainers_and_losers(pd.DataFrame()) == ([], [])


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
        "dashboard.lib.views_common.get_config",
        lambda section, org: {"patterns": [re.escape("openedx/")], "replacement": ""} if section == "redact" else real(section, org),
    )
    write_views(BuildContext(data=data, generated_at=GENERATED_AT), tmp_path)
    repos = json.loads((tmp_path / "repos.json").read_text(encoding="utf-8"))["records"]
    assert not any(r["repo_name"].startswith("openedx/") for r in repos)


def test_what_changed_carries_the_bulletin(built):
    _, files = built
    changed = files["what_changed.json"]
    bulletin = changed["bulletin"]
    assert bulletin.startswith("## Open edX Repo Health Weekly Bulletin")
    assert "Dashboard: https://openedx.ossvitals.org" in bulletin
    assert "Commit:" not in bulletin
    first = changed["new_failures"][0]
    assert f"- {first['repo_name']}: {first['check']}" in bulletin


def test_at_risk_reports_data_presence(built):
    _, files = built
    at_risk = files["at_risk.json"]
    assert at_risk["has_owner_data"] is False
    assert isinstance(at_risk["has_lifecycle_data"], bool)


def test_checks_carry_review_thresholds(built):
    _, files = built
    checks = files["checks.json"]
    assert 0 < checks["sparse_fill"] < checks["saturation_share"] <= 1


def test_failing_checks_rank_every_failing_check(built):
    _, files = built
    rows = files["failing_checks.json"]["records"]
    counts = [row["failing"] for row in rows]
    assert counts == sorted(counts, reverse=True) and min(counts) > 0
    assert not any(row["check"].startswith(("github.", "language_bytes.")) for row in rows)


def test_repos_carry_category_stats_and_owner_handles(built):
    _, files = built
    record = files["repos.json"]["records"][0]
    assert all(len(stats) == 3 for stats in record["category_stats"].values())
    assert record["repo_name"].split("/")[0] in record["owner_handles"]


def test_meta_lists_activity_signals_with_a_format_kind(built):
    _, files = built
    signals = files["meta.json"]["signals"]
    assert {signal["kind"] for signal in signals} <= {"count", "ratio", "days", "duration", "state"}
    assert signals[0] == {"column": "github.issues_open", "label": "Open issues", "group": "Issues", "kind": "count"}


def test_checks_carry_titles_remediation_and_pr_templates(built):
    _, files = built
    by_check = {row["check"]: row for row in files["checks.json"]["records"]}
    dependabot = by_check["dependabot.exists"]
    assert dependabot["title"] == "Dependabot Config"
    assert "`dependabot.exists`" in dependabot["remediation"]["issue_body"]
    assert dependabot["pr_template"]["branch"] == "chore/dependabot-config"
    unlisted = next(row for row in by_check.values() if not row["has_remediation"])
    assert unlisted["remediation"] is None and unlisted["pr_template"] is None


def test_repo_history_aligns_rates_to_dates(built):
    _, files = built
    history = files["repo_history.json"]
    series = next(iter(history["repos"].values()))
    assert all(len(rates) == len(history["dates"]) for rates in series.values())


def test_repo_checks_hold_raw_values(built):
    _, files = built
    values = next(iter(files["repo_checks.json"]["repos"].values()))
    assert all(value is None or (isinstance(value, str) and value == value.strip() and value) for value in values.values())
    assert {"True", "False"} & set(values.values())
    assert not any(column.startswith(("github.", "language_bytes.", "ownership.")) for column in values)


def test_components_join_findings_to_grades(built):
    _, files = built
    components = files["components.json"]
    assert components["available"] is True
    assert components["summary"]["repos"] == len(components["components"])
    first = components["findings"][0]
    assert {"label", "severity", "repos"} <= set(first)
    assert set(first["repos"][0]) == {"repo_name", "score_letter", "owner"}


def test_upgrades_carry_jobs_waves_and_redundant_prs(built):
    _, files = built
    upgrades = files["upgrades.json"]
    assert set(upgrades["upgrade_jobs"]["states"]) == {"failing", "not_landing", "healthy"}
    wave = upgrades["waves"][0]
    assert wave["available"] is True and wave["done_rule"].startswith("has ")
    not_started = next(row for row in wave["records"] if row["status"] == "not_started")
    assert not_started["gaps"]
    assert upgrades["redundant_prs"]["redundant"] == len(upgrades["redundant_prs"]["records"])


def test_owners_report_coverage_and_groups(built):
    _, files = built
    owners = files["owners.json"]
    assert owners["has_owner_data"] is False
    assert set(owners["groups"]) == {"theme", "squad"}


def test_views_without_maintenance_files_mark_them_unavailable(built, tmp_path):
    data, _ = built
    write_views(BuildContext(data=data, generated_at=GENERATED_AT), tmp_path)
    assert json.loads((tmp_path / "components.json").read_text())["available"] is False
    upgrades = json.loads((tmp_path / "upgrades.json").read_text())
    assert upgrades["upgrade_jobs"] is None and upgrades["redundant_prs"] is None
    assert all(wave["available"] is False for wave in upgrades["waves"])


def test_checks_carry_catalog_groups(built):
    _, files = built
    groups = files["checks.json"]["groups"]
    names = [group["name"] for group in groups]
    assert "Ownership" in names and names.index("Ownership") < len(names)
    listed = {check for group in groups for check in group["checks"]}
    assert listed == {row["check"] for row in files["checks.json"]["records"]}


def test_repo_detail_carries_the_page_rules_per_repo(built):
    data, files = built
    detail = files["repo_detail.json"]
    assert detail["catalog_available"] is True
    assert set(detail["repos"]) == set(data.scored["repo_name"])
    entry = next(iter(detail["repos"].values()))
    assert entry["summary"]["level"] in {"pass", "warn"}
    assert set(entry["subscores"]) == {"structural", "activity"}
    states = [bar["state"] for bar in entry["metric_bars"]]
    assert states == sorted(states, key=["measured", "defaulted", "unavailable"].index)
    assert {card["level"] for card in entry["category_cards"]} <= {"pass", "warn", "fail", "unknown"}
    with_catalog = next(value for value in detail["repos"].values() if value["catalog"])
    assert {"owner", "type", "lifecycle", "release", "relations", "findings"} <= set(with_catalog["catalog"])

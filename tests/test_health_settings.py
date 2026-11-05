import re
from pathlib import Path

import pytest
from jsonschema import ValidationError

from dashboard.lib.config import read_config_file
from dashboard.lib.health_settings import (
    HealthConfigError,
    build_settings,
    enabled_collectors,
    load_settings,
    published_pages,
    read_override,
)
from dashboard.lib.kinds import defaults_path
from scripts.list_tenants import load_index, orgs_of_kind

CATALOG = Path(__file__).resolve().parents[1] / "web" / "src" / "pages" / "catalog.ts"


def _defaults() -> dict:
    return read_config_file(defaults_path("health"))


def test_default_pages_are_every_page_the_health_web_module_routes():
    routed = re.findall(r'path: "(/[^"]*)"', CATALOG.read_text(encoding="utf-8"))
    assert _defaults()["pages"] == routed


def test_every_health_tenant_has_valid_settings():
    for org in orgs_of_kind(load_index(), "health"):
        assert load_settings(org)["pages"]


def test_a_tenant_page_list_replaces_the_default_one():
    assert build_settings(_defaults(), {"pages": ["/", "/repos"]})["pages"] == ["/", "/repos"]


def test_a_page_list_without_the_overview_is_rejected():
    with pytest.raises(ValidationError):
        build_settings(_defaults(), {"pages": ["/repos"]})


def test_an_unknown_key_is_rejected():
    with pytest.raises(ValidationError):
        build_settings(_defaults(), {"page": ["/"]})


def test_a_missing_override_means_the_defaults(tmp_path):
    assert read_override(tmp_path / "health.yaml") == {}


def test_an_unreadable_override_stops_the_run(tmp_path):
    path = tmp_path / "health.yaml"
    path.write_text("pages: [", encoding="utf-8")
    with pytest.raises(HealthConfigError):
        read_override(path)
    path.write_text("- /", encoding="utf-8")
    with pytest.raises(HealthConfigError):
        read_override(path)


def test_a_page_the_web_module_does_not_route_is_rejected():
    with pytest.raises(HealthConfigError, match="/repo$"):
        build_settings(_defaults(), {"pages": ["/", "/repo"]})


def test_unreadable_defaults_stop_the_run():
    with pytest.raises(HealthConfigError, match="defaults.yaml"):
        build_settings({}, {"version": 1, "pages": ["/"]})


def test_default_collectors_are_exactly_the_maintenance_collectors():
    from scripts.collect_maintenance import COLLECTORS

    assert list(_defaults()["collectors"]) == list(COLLECTORS)


def test_openedx_keeps_every_collector_and_page():
    values = load_settings("openedx")
    assert enabled_collectors(values) == list(_defaults()["collectors"])
    assert published_pages(values) == _defaults()["pages"]


def test_a_tenant_on_the_defaults_publishes_no_page_for_an_ecosystem_collector():
    pages = published_pages(build_settings(_defaults(), {}))
    assert "/components" not in pages
    assert "/support_window" not in pages
    assert "/platform" not in pages
    assert "/maintenance" in pages


def test_turning_a_collector_on_merges_into_the_defaults():
    values = build_settings(_defaults(), {"collectors": {"catalog": True}})
    assert "catalog" in enabled_collectors(values)
    assert "fix_prs" in enabled_collectors(values)


def test_an_unknown_collector_is_rejected():
    with pytest.raises(ValidationError):
        build_settings(_defaults(), {"collectors": {"catalogue": True}})


def test_a_page_collector_for_an_unknown_page_is_rejected():
    with pytest.raises(HealthConfigError, match="/component$"):
        build_settings(_defaults(), {"page_collectors": {"/component": "catalog"}})


def test_views_ignore_the_files_of_collectors_that_are_off():
    from dashboard.lib.views_maintenance import maintenance_keys

    keys = maintenance_keys({"uv": {}}, {"c": {}}, ["waves", "fix_prs"])
    assert keys == ["fix_prs.json", "waves/uv.json"]
    assert len(maintenance_keys({"uv": {}}, {"c": {}})) == 9


def test_freshness_checks_only_the_files_of_collectors_that_are_on(monkeypatch):
    import scripts.check_freshness as freshness

    monkeypatch.setattr(freshness, "load_settings", lambda org: build_settings(_defaults(), {}))
    files = [file for _, file in freshness._maintenance_files("newtenant")]
    assert "upgrade_jobs.json" not in files
    assert "support_windows.json" not in files
    assert "redundant_prs.json" in files


def test_broken_health_settings_are_reported_as_stale_not_raised(monkeypatch):
    import scripts.check_freshness as freshness

    def broken(org):
        raise HealthConfigError("bad")

    monkeypatch.setattr(freshness, "load_settings", broken)
    monkeypatch.setattr(freshness, "get_config", lambda section, org: {"csv_url": "u", "scores_url": "s"})
    [result] = freshness._upstream_statuses("newtenant", None)
    assert result.name == "newtenant health settings"

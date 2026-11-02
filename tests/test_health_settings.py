import re
from pathlib import Path

import pytest
from jsonschema import ValidationError

from dashboard.lib.config import read_config_file
from dashboard.lib.health_settings import HealthConfigError, build_settings, load_settings, read_override
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

import json
from pathlib import Path
from urllib.parse import urlparse

from collectors.fleet.settings import load_settings
from dashboard.lib.config import CONFIG_DIR
from scripts.list_tenants import load_index, orgs_of_kind

WRANGLER = Path(__file__).resolve().parents[1] / "web" / "wrangler.json"


def test_the_index_validates_and_every_org_has_a_config_folder():
    index = load_index()
    assert all((CONFIG_DIR / org / "org_branding.yaml").is_file() for org in index)


def test_every_fleet_tenant_has_working_settings_and_an_app_inventory():
    for org in orgs_of_kind(load_index(), "fleet"):
        assert load_settings(org).org == org
        assert (CONFIG_DIR / org / "apps.yaml").is_file()


def test_every_site_is_routed_by_the_web_worker():
    routes = {route["pattern"] for route in json.loads(WRANGLER.read_text())["routes"]}
    assert {urlparse(tenant["site"]).hostname for tenant in load_index().values()} <= routes


def test_orgs_of_kind_lists_only_that_kind_in_order():
    index = {"b": {"kind": "fleet"}, "a": {"kind": "fleet"}, "c": {"kind": "health"}}
    assert orgs_of_kind(index, "fleet") == ["a", "b"]

import json
from pathlib import Path
from urllib.parse import urlparse

from collectors.fleet.settings import load_settings
from dashboard.lib.config import CONFIG_DIR
import pytest
from jsonschema import ValidationError

from dashboard.lib.schema import validate_config_data
from scripts.list_tenants import PRIVATE, is_private, load_index, orgs_of_kind, orgs_with

ROOT = Path(__file__).resolve().parents[1]
WRANGLER = ROOT / "web" / "wrangler.json"
GATE_WRANGLER = ROOT / "gate" / "wrangler.json"


def _hosts(tenants) -> set[str]:
    return {urlparse(tenant["site"]).hostname for tenant in tenants}


def _routes(wrangler: Path) -> set[str]:
    return {route["pattern"] for route in json.loads(wrangler.read_text())["routes"]}


def _public(index):
    return [tenant for tenant in index.values() if not is_private(tenant)]


def _private(index):
    return [tenant for tenant in index.values() if is_private(tenant)]


def test_the_index_validates_and_every_public_org_has_a_config_folder():
    index = load_index()
    assert all((CONFIG_DIR / org / "org_branding.yaml").is_file() for org, tenant in index.items() if not is_private(tenant))


def test_a_private_tenant_keeps_its_config_out_of_this_public_repository():
    """Its runner repository holds the config; a folder here would publish the names of its private repos."""
    assert not any((CONFIG_DIR / org).exists() for org in orgs_with(load_index(), visibility=PRIVATE))


def test_every_fleet_tenant_has_working_settings_and_an_app_inventory():
    for org in orgs_of_kind(load_index(), "fleet"):
        assert load_settings(org).org == org
        assert (CONFIG_DIR / org / "apps.yaml").is_file()


def test_every_site_is_the_orgs_own_subdomain():
    """The web app picks the tenant from the subdomain; any other host falls back to openedx."""
    assert all(urlparse(tenant["site"]).hostname == f"{org}.ossvitals.org" for org, tenant in load_index().items())


def test_public_sites_are_routed_by_the_web_worker_and_private_ones_only_by_the_gate():
    index = load_index()
    assert _hosts(_public(index)) <= _routes(WRANGLER)
    assert _hosts(_private(index)) <= _routes(GATE_WRANGLER)
    assert not _hosts(_private(index)) & _routes(WRANGLER)
    assert not _hosts(_public(index)) & _routes(GATE_WRANGLER)


def test_openedx_is_the_only_health_tenant_until_the_health_module_takes_an_org():
    assert orgs_of_kind(load_index(), "health") == ["openedx"]


def test_orgs_of_kind_lists_only_that_kind_in_order():
    index = {"b": {"kind": "fleet"}, "a": {"kind": "fleet"}, "c": {"kind": "health"}}
    assert orgs_of_kind(index, "fleet") == ["a", "b"]


def test_public_workflows_never_list_a_private_tenant():
    index = {"a": {"kind": "fleet"}, "p": {"kind": "fleet", "visibility": "private"}}
    assert orgs_of_kind(index, "fleet") == ["a"]
    assert orgs_with(index, visibility=PRIVATE) == ["p"]


PRIVATE_SITE = {"kind": "fleet", "site": "https://p.ossvitals.org", "visibility": "private"}


@pytest.mark.parametrize(
    "tenant",
    [
        PRIVATE_SITE,
        {**PRIVATE_SITE, "access": {"email_domains": []}},
        {**PRIVATE_SITE, "access": {"email_domains": ["Not A Domain"]}},
        {"kind": "fleet", "site": "https://a.ossvitals.org", "access": {"email_domains": ["a.com"]}},
    ],
)
def test_the_schema_requires_sign_in_rules_exactly_for_private_tenants(tenant):
    with pytest.raises(ValidationError):
        validate_config_data("tenants", {"p": tenant}, strict=True)


def test_the_schema_accepts_a_private_tenant_with_email_domains():
    validate_config_data("tenants", {"p": {**PRIVATE_SITE, "access": {"email_domains": ["arbisoft.com", "edly.io"]}}}, strict=True)

import pytest
from jsonschema import ValidationError

from collectors.fleet import meta
from collectors.fleet.registry import SIGNALS
from collectors.fleet.settings import DEFAULTS_PATH, FleetConfigError, build_settings, load_settings, merge
from dashboard.lib.config import read_config_file

DEFAULTS = read_config_file(DEFAULTS_PATH)


def settings(override):
    return build_settings("demo", DEFAULTS, override)


def test_mappings_merge_key_by_key_and_lists_replace():
    assert merge({"a": {"x": 1, "y": 2}, "l": [1, 2]}, {"a": {"y": 3}, "l": [9]}) == {"a": {"x": 1, "y": 3}, "l": [9]}


def test_an_empty_override_is_a_working_tenant():
    tenant = settings({})
    assert tenant.production == "main"
    assert tenant.staging is None
    assert not tenant.collects("promotion")


def test_every_signal_in_the_registry_has_defaults():
    assert set(DEFAULTS["signals"]) == {signal.key for signal in SIGNALS}


def test_moneta_overrides_only_its_conventions():
    moneta = load_settings("moneta")
    assert (moneta.production, moneta.staging) == ("foss-main", "foss-sandbox")
    assert moneta.collects("promotion")


def test_turning_a_signal_off_drops_its_thresholds_from_the_default_statuses():
    tenant = settings({"signals": {"advisories": {"collect": False}, "release_gap": {"collect": False}}})
    keys = {key for status in tenant.statuses for key in status}
    assert not keys & {"on_severe_advisory", "min_version_gap", "min_releases_behind", "min_days_behind_release"}
    assert "min_behind" in keys


def test_a_tenant_status_using_a_signal_it_turned_off_is_an_error():
    override = {
        "signals": {"advisories": {"collect": False}},
        "statuses": [{"key": "ok", "label": "OK"}, {"key": "bad", "label": "Bad", "on_severe_advisory": True}],
    }
    with pytest.raises(FleetConfigError, match="on_severe_advisory"):
        settings(override)


def test_promotion_needs_a_staging_branch():
    with pytest.raises(FleetConfigError, match="branches.staging"):
        settings({"signals": {"promotion": {"collect": True}}})


def test_an_unknown_signal_or_surface_is_rejected():
    with pytest.raises(ValidationError):
        settings({"signals": {"astrology": {"collect": True, "show": []}}})
    with pytest.raises(ValidationError):
        settings({"signals": {"ci": {"show": ["sidebar"]}}})


def test_the_manifest_lists_off_signals_as_not_collected_and_not_shown():
    tenant = settings({"signals": {"maintainers": {"collect": False}, "ci": {"show": []}}})
    manifest = meta.signal_manifest(tenant)
    assert list(manifest) == [signal.key for signal in SIGNALS]
    assert manifest["maintainers"] == {"collect": False, "show": [], "tier": "api", "cadence": "daily"}
    assert manifest["ci"]["collect"] is True and manifest["ci"]["show"] == []
    assert manifest["conflicts"]["tier"] == "clone"


def test_a_misspelt_setting_inside_a_signal_is_rejected():
    with pytest.raises(ValidationError):
        settings({"signals": {"upstream_activity": {"quiet_dayz": 1}}})

import pytest

from dashboard.lib import config


@pytest.fixture
def layout(tmp_path, monkeypatch):
    (tmp_path / "_kinds" / "health").mkdir(parents=True)
    (tmp_path / "acme").mkdir()
    (tmp_path / "loner").mkdir()
    (tmp_path / "_kinds" / "health" / "strings.yaml").write_text("common:\n  a: kind\n  b: kind\n", encoding="utf-8")
    monkeypatch.setattr(config, "CONFIG_DIR", tmp_path)
    monkeypatch.setattr(config, "KINDS_DIR", tmp_path / "_kinds")
    monkeypatch.setattr(config, "_tenant_kinds", lambda: {"acme": "health"})
    config._load_config.cache_clear()
    yield tmp_path
    config._load_config.cache_clear()


def test_a_tenant_without_its_own_file_gets_the_kind_default(layout):
    assert config.get_config("strings", "acme") == {"common": {"a": "kind", "b": "kind"}}


def test_a_tenant_file_is_merged_over_the_kind_default(layout):
    (layout / "acme" / "strings.yaml").write_text("common:\n  b: tenant\n", encoding="utf-8")
    assert config.get_config("strings", "acme") == {"common": {"a": "kind", "b": "tenant"}}


def test_an_org_outside_the_tenant_index_reads_only_its_own_folder(layout):
    assert config.get_config("strings", "loner") == {}


def test_every_tenant_in_the_index_has_a_known_kind():
    assert config.tenant_kind("openedx") == "health"
    assert config.tenant_kind("moneta") == "fleet"
    assert config.tenant_kind("not-a-tenant") is None

from dashboard.lib import config


def test_active_org_defaults_to_openedx(monkeypatch):
    monkeypatch.delenv(config.ORG_ENV_VAR, raising=False)
    assert config.active_org() == config.DEFAULT_ORG


def test_active_org_reads_environment(monkeypatch):
    monkeypatch.setenv(config.ORG_ENV_VAR, " moneta ")
    assert config.active_org() == "moneta"


def test_blank_environment_falls_back_to_default(monkeypatch):
    monkeypatch.setenv(config.ORG_ENV_VAR, "  ")
    assert config.active_org() == config.DEFAULT_ORG


def test_get_config_follows_active_org(monkeypatch, tmp_path):
    (tmp_path / "other").mkdir()
    (tmp_path / "other" / "branding.yaml").write_text("short_name: Other\n")
    monkeypatch.setattr(config, "CONFIG_DIR", tmp_path)
    config._load_config.cache_clear()
    monkeypatch.setenv(config.ORG_ENV_VAR, "other")
    assert config.get_config("branding") == {"short_name": "Other"}
    assert config.get_config("branding", "missing") == {}
    config._load_config.cache_clear()


def test_explicit_org_overrides_environment(monkeypatch):
    monkeypatch.setenv(config.ORG_ENV_VAR, "missing")
    assert config.get_config("scoring", config.DEFAULT_ORG)["metrics"]

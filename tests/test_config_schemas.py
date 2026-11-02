from dashboard.lib.config import get_config, kinds_dir, read_config_file
from dashboard.lib.schema import validate_config_data


def test_every_health_kind_default_validates_on_its_own():
    """A tenant with no file of its own for a section gets the kind default unchanged."""
    for path in sorted((kinds_dir() / "health").glob("*.yaml")):
        if path.stem != "defaults":
            assert validate_config_data(path.stem, read_config_file(path), strict=True), path.name


def test_openedx_config_validates_against_schemas():
    config_names = [
        "data_source",
        "check_groups",
        "check_descriptions",
        "check_candidates",
        "remediation",
        "pr_templates",
        "scoring",
        "scoring_proposed",
        "tiers",
        "attention_rules",
        "strings",
        "org_branding",
        "waves",
        "campaign_supersession",
        "campaigns",
        "support_windows",
    ]

    for name in config_names:
        assert validate_config_data(name, get_config(name, "openedx"), strict=True)


def test_feature_flags_config_validates_against_schema():
    payload = read_config_file("config/feature_flags.yaml")
    assert validate_config_data("feature_flags", payload, strict=True)


def test_moneta_config_files_validate_against_schemas():
    for name in ["org_branding", "apps", "updates"]:
        payload = read_config_file(f"config/moneta/{name}.yaml")
        assert validate_config_data(name, payload, strict=True)


def test_moneta_apps_are_unique_and_forks_declare_an_upstream():
    apps = read_config_file("config/moneta/apps.yaml")["apps"]
    repos = [app["repo"] for app in apps]
    assert len(repos) == len(set(repos))
    assert all(app["upstream"] for app in apps if app["class"] == "fork")

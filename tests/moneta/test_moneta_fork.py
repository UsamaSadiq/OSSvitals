from datetime import datetime, timezone

import pytest

from collectors.moneta import fork, inventory, meta
from dashboard.lib.config import read_config_file

RULES = read_config_file("config/moneta/status.yaml")
NOW = datetime(2026, 10, 12, tzinfo=timezone.utc)
APP = {"repo": "demo", "class": "fork", "upstream": "up/demo", "upstream_branch": "main"}
BASE = "repos/Org/demo"


def commit(date):
    return {"commit": {"committer": {"date": date}}}


def api_for(routes):
    return lambda path: routes.get(path)


ROUTES = {
    f"{BASE}/compare/up:main...foss-main": {
        "ahead_by": 3,
        "behind_by": 120,
        "merge_base_commit": commit("2026-09-12T00:00:00Z"),
    },
    f"{BASE}/tags?per_page=100": [
        {"name": "v1.4.0", "commit": {"sha": "up140"}},
        {"name": "v26.9.0", "commit": {"sha": "fork926"}},
        {"name": "v26.9.0-rc.1", "commit": {"sha": "rc"}},
        {"name": "v26.8.0", "commit": {"sha": "fork926old"}},
    ],
    f"{BASE}/compare/up:main...up140": {"ahead_by": 0},
    f"{BASE}/compare/up:main...fork926": {"ahead_by": 2},
    f"{BASE}/commits/fork926": commit("2026-09-20T00:00:00Z"),
    "repos/up/demo/releases/latest": {"tag_name": "v1.5.0", "published_at": "2026-10-01T00:00:00Z"},
    "repos/up/demo/security-advisories?per_page=100": [
        {"published_at": "2026-09-01T00:00:00Z"},
        {"published_at": "2026-09-25T00:00:00Z"},
    ],
    f"{BASE}/compare/foss-main...foss-sandbox": {"ahead_by": 4},
}


def test_fork_record_reports_drift_release_advisories_and_status():
    record = fork.collect_fork(api_for(ROUTES), "Org", APP, RULES, NOW)
    assert record["ahead_by"] == 3
    assert record["behind_by"] == 120
    assert record["days_since_upstream_merge"] == 30
    assert record["fork_release"] == {"tag": "v26.9.0", "date": "2026-09-20T00:00:00Z"}
    assert record["upstream_release"] == {"tag": "v1.5.0", "date": "2026-10-01T00:00:00Z"}
    assert record["advisories"]["since_fork_release"] == 1
    assert record["promotion"] == {"unpromoted_commits": 4}
    assert record["status"] == "critical"


def test_tags_inherited_from_upstream_are_not_fork_releases():
    routes = {**ROUTES, f"{BASE}/tags?per_page=100": [{"name": "v1.4.0", "commit": {"sha": "up140"}}]}
    assert fork.latest_fork_release(api_for(routes), BASE, "up:main") is None


def test_prerelease_and_non_version_tags_are_ignored():
    names = [{"name": "v2.0.0-rc.1"}, {"name": "twenty/v2.0.0"}, {"name": "v1.10.0"}, {"name": "v1.9.0"}]
    assert [tag["name"] for tag in fork.stable_tags(names)] == ["v1.10.0", "v1.9.0"]


def test_apps_with_their_own_production_branch_have_no_promotion_lag():
    app = {**APP, "production_branch": "main"}
    routes = {**ROUTES, f"{BASE}/compare/up:main...main": ROUTES[f"{BASE}/compare/up:main...foss-main"]}
    assert fork.collect_fork(api_for(routes), "Org", app, RULES, NOW)["promotion"] is None


def test_a_missing_comparison_is_an_error_for_that_fork():
    with pytest.raises(LookupError):
        fork.collect_fork(api_for({}), "Org", APP, RULES, NOW)


def test_upstream_without_releases_falls_back_to_its_newest_stable_tag():
    routes = {"repos/up/demo/tags?per_page=100": [{"name": "v0.3.4"}, {"name": "v0.3.10"}]}
    assert fork.latest_upstream_release(api_for(routes), "up/demo") == {"tag": "v0.3.10", "date": None}


def test_inventory_record_for_an_original_has_no_upstream():
    routes = {
        BASE: {"html_url": "https://github.com/Org/demo", "description": "d", "pushed_at": "2026-10-01T00:00:00Z", "open_issues_count": 2},
        f"{BASE}/tags?per_page=100": [{"name": "v1.0.0"}],
    }
    record = inventory.collect_app(api_for(routes), "Org", {"repo": "demo", "class": "original", "licence": "MIT"})
    assert record["upstream"] is None
    assert record["upstream_url"] is None
    assert record["latest_tag"] == "v1.0.0"


def test_meta_view_satisfies_the_tenant_contract():
    view = meta.meta_view("moneta", NOW, branding={"name": "n"}, rules=RULES, github_org="Org")
    assert view["metadata"]["org"] == "moneta"
    assert view["metadata"]["snapshot_timestamp"] is None
    assert view["pages"] == ["/"]
    assert view["stale_threshold_hours"] == 48
    assert view["critically_stale_threshold_hours"] == 168
    assert "enable_maintainer_views" in view["feature_flags"]


def test_audit_fixture_is_what_the_collector_would_publish():
    import json
    from pathlib import Path

    from dashboard.lib.config import get_config

    fixture = json.loads(Path("tests/fixtures/moneta/views/meta.json").read_text())
    generated_at = datetime.fromisoformat(fixture["metadata"]["generated_at"])
    expected = meta.meta_view("moneta", generated_at, branding=get_config("org_branding", "moneta"), rules=RULES, github_org="Pressingly")
    assert fixture == json.loads(json.dumps(expected))

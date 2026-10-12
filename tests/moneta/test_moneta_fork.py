import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from collectors.moneta import fork, inventory, meta
from dashboard.lib.config import get_config, read_config_file

RULES = read_config_file("config/moneta/status.yaml")
NOW = datetime(2026, 10, 12, tzinfo=timezone.utc)
APP = {"repo": "demo", "class": "fork", "upstream": "up/demo", "upstream_branch": "main"}
BASE = "repos/Org/demo"


def commit(date):
    return {"commit": {"committer": {"date": date}}}


def api_for(routes):
    return lambda path: routes.get(path)


def release(tag, published, prerelease=False):
    return {"tag_name": tag, "published_at": published, "draft": False, "prerelease": prerelease}


ROUTES = {
    f"{BASE}/compare/up:main...foss-main": {
        "ahead_by": 3,
        "behind_by": 120,
        "merge_base_commit": commit("2026-09-12T00:00:00Z"),
    },
    f"{BASE}/tags?per_page=100": [
        {"name": "v1.4.0", "commit": {"sha": "up140"}},
        {"name": "v26.9.0", "commit": {"sha": "fork926"}},
        {"name": "v26.10.0-rc.1", "commit": {"sha": "rc1"}},
        {"name": "v26.8.0", "commit": {"sha": "fork926old"}},
    ],
    f"{BASE}/compare/up:main...up140": {"ahead_by": 0},
    f"{BASE}/compare/up:main...fork926": {"ahead_by": 2},
    f"{BASE}/compare/up:main...rc1": {"ahead_by": 1},
    f"{BASE}/commits/fork926": commit("2026-09-20T00:00:00Z"),
    "repos/up/demo/releases?per_page=100": [
        release("v1.5.0", "2026-10-01T00:00:00Z"),
        release("v1.5.0-beta", "2026-09-28T00:00:00Z", prerelease=True),
        release("v1.4.0", "2026-09-15T00:00:00Z"),
        release("v1.3.0", "2026-09-01T00:00:00Z"),
    ],
    "repos/up/demo/security-advisories?per_page=100": [
        {"published_at": "2026-09-01T00:00:00Z", "severity": "critical", "ghsa_id": "GHSA-old"},
        {"published_at": "2026-09-25T00:00:00Z", "severity": "low", "ghsa_id": "GHSA-low", "summary": "s", "html_url": "u"},
    ],
    f"{BASE}/compare/foss-main...foss-sandbox": {"ahead_by": 4},
    f"{BASE}/commits/foss-main/check-runs?per_page=100": {"check_runs": [{"conclusion": "success"}, {"conclusion": None}]},
    f"{BASE}/pulls?base=foss-main&state=open&per_page=100": [
        {"number": 7, "title": "Sync with upstream", "head": {"ref": "sync/up"}, "html_url": "https://x/7"},
        {"number": 8, "title": "Fix login", "head": {"ref": "fix"}, "html_url": "https://x/8"},
    ],
    "repos/up/demo": {"pushed_at": "2026-04-01T00:00:00Z"},
}


def merged_by(owner, name, base):
    return ["bob", "alice", "bob"] if (owner, name, base) == ("Org", "demo", "foss-main") else None


def collect(routes=ROUTES, app=APP):
    return fork.collect_fork(api_for(routes), "Org", app, RULES, NOW, merged_by)


def test_fork_record_reports_drift_release_and_promotion():
    record = collect()
    assert (record["ahead_by"], record["behind_by"], record["days_since_upstream_merge"]) == (3, 120, 30)
    assert record["fork_release"] == {"tag": "v26.9.0", "date": "2026-09-20T00:00:00Z"}
    assert record["upstream_release"] == {"tag": "v1.5.0", "date": "2026-10-01T00:00:00Z"}
    assert record["promotion"] == {"unpromoted_commits": 4}
    assert record["status"] == "lagging"


def test_a_low_severity_advisory_does_not_make_a_fork_critical_but_is_listed():
    advisories = collect()["advisories"]
    assert (advisories["published"], advisories["since_fork_release"], advisories["severe_since_fork_release"]) == (2, 1, 0)
    newest = advisories["items"][0]
    assert (newest["ghsa_id"], newest["after_our_release"]) == ("GHSA-low", True)


def test_a_severe_advisory_after_our_release_makes_the_fork_critical():
    advisories = [{"published_at": "2026-09-25T00:00:00Z", "severity": "high", "ghsa_id": "G"}]
    routes = {**ROUTES, "repos/up/demo/security-advisories?per_page=100": advisories}
    assert collect(routes)["status"] == "critical"


def test_release_lag_counts_stable_upstream_releases_since_the_last_sync():
    lag = collect()["release_lag"]
    assert lag["upstream_releases_since_sync"] == 2
    assert lag["upstream_ahead_of_our_release_days"] == 11


def test_a_newer_fork_release_candidate_is_pending():
    assert collect()["release_candidate"] == {"tag": "v26.10.0-rc.1"}


def test_a_release_candidate_older_than_our_release_is_not_pending():
    tags = [{"name": "v26.9.0", "commit": {"sha": "fork926"}}, {"name": "v26.8.0-rc.1", "commit": {"sha": "rc1"}}]
    assert collect({**ROUTES, f"{BASE}/tags?per_page=100": tags})["release_candidate"] is None


def test_extra_signals_ci_pull_requests_merge_maintainers_and_upstream_activity():
    record = collect()
    assert record["ci"] == {"state": "pending", "total": 2}
    assert record["pull_requests"] == {"open": 2, "sync_pull": {"number": 7, "title": "Sync with upstream", "url": "https://x/7"}}
    assert record["maintainers"] == [{"login": "bob", "merged": 2}, {"login": "alice", "merged": 1}]
    assert record["upstream_activity"]["quiet"] is True


def test_tags_inherited_from_upstream_are_not_fork_releases():
    tags = [{"name": "v1.4.0", "commit": {"sha": "up140"}}]
    assert fork.latest_fork_release(api_for(ROUTES), BASE, "up:main", tags) is None


def test_prerelease_and_non_version_tags_are_ignored():
    names = [{"name": "v2.0.0-rc.1"}, {"name": "twenty/v2.0.0"}, {"name": "v1.10.0"}, {"name": "v1.9.0"}]
    assert [tag["name"] for tag in fork.stable_tags(names)] == ["v1.10.0", "v1.9.0"]


def test_apps_with_their_own_production_branch_have_no_promotion_lag():
    app = {**APP, "production_branch": "main"}
    routes = {**ROUTES, f"{BASE}/compare/up:main...main": ROUTES[f"{BASE}/compare/up:main...foss-main"]}
    assert collect(routes, app)["promotion"] is None


def test_a_failing_optional_signal_does_not_fail_the_record():
    def api(path):
        if "check-runs" in path:
            raise RuntimeError("boom")
        return ROUTES.get(path)

    record = fork.collect_fork(api, "Org", APP, RULES, NOW, merged_by)
    assert record["ci"] is None
    assert record["status"] == "lagging"


def test_maintainers_are_unknown_not_empty_when_the_lookup_fails():
    assert fork.collect_fork(api_for(ROUTES), "Org", APP, RULES, NOW)["maintainers"] is None


def test_a_missing_comparison_is_an_error_for_that_fork():
    with pytest.raises(LookupError):
        collect({})


def test_upstream_without_releases_falls_back_to_its_newest_stable_tag():
    routes = {"repos/up/demo/tags?per_page=100": [{"name": "v0.3.4"}, {"name": "v0.3.10"}]}
    assert fork.latest_upstream_release(api_for(routes), "up/demo", []) == {"tag": "v0.3.10", "date": None}


REPO_BODY = {"html_url": "https://github.com/Org/demo", "description": "d", "pushed_at": "2026-10-01T00:00:00Z", "open_issues_count": 2, "default_branch": "main"}


def test_inventory_record_for_an_original_has_no_upstream():
    routes = {BASE: REPO_BODY, f"{BASE}/tags?per_page=100": [{"name": "v1.0.0"}]}
    record = inventory.collect_app(api_for(routes), "Org", {"repo": "demo", "class": "original", "licence": "MIT"}, "foss-main")
    assert (record["upstream"], record["upstream_url"], record["upstream_branch"], record["production_branch"]) == (None, None, None, None)
    assert record["latest_tag"] == "v1.0.0"


def test_inventory_counts_every_open_pull_request():
    routes = {
        BASE: REPO_BODY,
        f"{BASE}/tags?per_page=100": [],
        f"{BASE}/pulls?state=open&per_page=100": [{"number": 1}, {"number": 2}, {"number": 3}],
    }
    assert inventory.collect_app(api_for(routes), "Org", APP, "foss-main")["open_pull_requests"] == 3


def test_inventory_record_for_a_fork_carries_branches_and_integration_fields():
    routes = {BASE: REPO_BODY, f"{BASE}/tags?per_page=100": []}
    app = {**APP, "licence": "MIT", "licence_note": "n", "mcp_server": "demo-mcp", "sso": "done"}
    record = inventory.collect_app(api_for(routes), "Org", app, "foss-main")
    assert (record["upstream_branch"], record["production_branch"]) == ("main", "foss-main")
    assert (record["licence_note"], record["mcp_server"], record["sso"]) == ("n", "demo-mcp", "done")
    own = inventory.collect_app(api_for(routes), "Org", {**APP, "production_branch": "main"}, "foss-main")
    assert own["production_branch"] == "main"


def test_fork_notes_from_the_repository_replace_the_configured_text():
    routes = {BASE: REPO_BODY, f"{BASE}/tags?per_page=100": []}
    notes = lambda full_name, path, ref: "  We patched auth.  " if (path, ref) == ("FORK.md", "foss-main") else None
    record = inventory.collect_app(api_for(routes), "Org", {**APP, "what_we_changed": "old"}, "foss-main", notes)
    assert record["what_we_changed"] == "We patched auth."
    assert inventory.collect_app(api_for(routes), "Org", {**APP, "what_we_changed": "old"}, "foss-main")["what_we_changed"] == "old"


def test_meta_view_satisfies_the_tenant_contract():
    view = meta.meta_view("moneta", NOW, branding={"name": "n"}, rules=RULES, github_org="Org")
    assert view["metadata"]["org"] == "moneta"
    assert view["metadata"]["snapshot_timestamp"] == NOW.isoformat()
    assert view["pages"] == ["/", "/apps", "/attention"]
    assert view["stale_threshold_hours"] == 48
    assert view["critically_stale_threshold_hours"] == 168
    assert "enable_maintainer_views" in view["feature_flags"]


def test_audit_fixture_is_what_the_collector_would_publish():
    fixture = json.loads(Path("tests/fixtures/moneta/views/meta.json").read_text())
    generated_at = datetime.fromisoformat(fixture["metadata"]["generated_at"])
    expected = meta.meta_view("moneta", generated_at, branding=get_config("org_branding", "moneta"), rules=RULES, github_org="Pressingly")
    assert fixture == json.loads(json.dumps(expected))


@pytest.mark.parametrize("name", ["apps", "drift", "drift_history", "updates", "conflicts"])
def test_audit_fixture_records_match_the_published_view_shape(name):
    view = json.loads(Path(f"tests/fixtures/moneta/views/{name}.json").read_text())
    assert set(view) == {"metadata", "records"}
    assert view["metadata"]["org"] == "moneta"

import json
import re
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


def test_upstream_tags_matching_no_fork_pattern_never_become_a_fork_release():
    chatwoot_tags = [{"name": "v4.18.0", "commit": {"sha": "up418"}}, {"name": "v26.10.0", "commit": {"sha": "fork2610"}}]
    routes = {
        **ROUTES,
        f"{BASE}/tags?per_page=100": chatwoot_tags,
        f"{BASE}/compare/up:main...up418": {"ahead_by": 5},
        f"{BASE}/compare/up:main...fork2610": {"ahead_by": 1},
        f"{BASE}/commits/fork2610": commit("2026-10-02T00:00:00Z"),
    }
    assert collect(routes)["fork_release"] == {"tag": "v26.10.0", "date": "2026-10-02T00:00:00Z"}


def test_a_fork_release_pattern_can_be_set_per_app():
    tags = [{"name": "v26.9.0", "commit": {"sha": "fork926"}}, {"name": "rel-26.11", "commit": {"sha": "r5"}}]
    routes = {**ROUTES, f"{BASE}/tags?per_page=100": tags, f"{BASE}/compare/up:main...r5": {"ahead_by": 1}, f"{BASE}/commits/r5": commit("2026-10-03T00:00:00Z")}
    assert collect(routes, {**APP, "fork_release_tag": r"^rel-\d+\.\d+$"})["fork_release"] == {"tag": "rel-26.11", "date": "2026-10-03T00:00:00Z"}


def test_an_rc_must_match_the_fork_pattern_once_its_suffix_is_removed():
    tags = [{"name": "v4.19.0-rc.1", "commit": {"sha": "x"}}, {"name": "v26.10.0-rc.1", "commit": {"sha": "rc1"}}]
    assert [tag["name"] for tag in fork.rc_tags(tags, re.compile(fork.FORK_RELEASE_TAG))] == ["v26.10.0-rc.1"]


def release_pair(tag, published):
    return {"tag_name": tag, "published_at": published, "draft": False, "prerelease": False}


def test_a_release_pattern_keeps_one_release_line_out_of_a_shared_repository():
    releases = [
        release_pair("sdk/v1.5.0", "2026-10-02T00:00:00Z"),
        release_pair("app/v1.5.0", "2026-10-01T00:00:00Z"),
        release_pair("sdk/v1.4.0", "2026-09-20T00:00:00Z"),
        release_pair("app/v1.4.0", "2026-09-15T00:00:00Z"),
    ]
    routes = {"repos/up/demo/releases?per_page=100": releases}
    pattern = re.compile(r"^app/v\d+\.\d+\.\d+$")
    kept = fork.upstream_releases(api_for(routes), "up/demo", pattern)
    assert [release["tag_name"] for release in kept] == ["app/v1.5.0", "app/v1.4.0"]
    assert fork.latest_upstream_release(api_for(routes), "up/demo", kept, pattern)["tag"] == "app/v1.5.0"
    assert fork.release_lag(kept, "2026-09-16T00:00:00Z", None)["upstream_releases_since_sync"] == 1


def test_the_newest_release_wins_whatever_order_the_api_returns():
    releases = [release_pair("v1.0.0", "2026-01-01T00:00:00Z"), release_pair("v1.1.0", "2026-02-01T00:00:00Z")]
    kept = fork.upstream_releases(api_for({"repos/up/demo/releases?per_page=100": releases}), "up/demo")
    assert kept[0]["tag_name"] == "v1.1.0"


def test_distance_to_the_upstream_release_is_reported_beside_the_branch_distance():
    routes = {**ROUTES, f"{BASE}/compare/up:v1.5.0...foss-main": {"ahead_by": 3, "behind_by": 90}}
    record = collect(routes)
    assert (record["behind_by"], record["behind_release"], record["ahead_release"]) == (120, 90, 3)


def test_release_distance_is_null_when_the_upstream_tag_cannot_be_compared():
    record = collect()
    assert (record["behind_release"], record["ahead_release"]) == (None, None)


def test_an_advisory_is_matched_to_the_upstream_version_the_fork_release_is_based_on():
    advisories = [
        {"published_at": "2026-09-25T00:00:00Z", "severity": "high", "ghsa_id": "FIXED", "vulnerabilities": [{"vulnerable_version_range": "< 1.4.0"}]},
        {"published_at": "2026-09-10T00:00:00Z", "severity": "high", "ghsa_id": "OPEN", "vulnerabilities": [{"vulnerable_version_range": "< 1.5.0"}]},
        {"published_at": "2026-09-05T00:00:00Z", "severity": "low", "ghsa_id": "UNKNOWN"},
    ]
    routes = {
        **ROUTES,
        "repos/up/demo/security-advisories?per_page=100": advisories,
        f"{BASE}/compare/up:v1.5.0...v26.9.0": {"behind_by": 7},
        f"{BASE}/compare/up:v1.4.0...v26.9.0": {"behind_by": 0},
    }
    result = collect(routes)["advisories"]
    verdicts = {item["ghsa_id"]: item["affects_fork_release"] for item in result["items"]}
    assert verdicts == {"FIXED": False, "OPEN": True, "UNKNOWN": None}
    assert (result["base_release"], result["affecting_fork_release"], result["severe_affecting_fork_release"]) == ("v1.4.0", 1, 1)


def test_advisories_are_unmatched_when_the_base_release_cannot_be_found():
    result = collect()["advisories"]
    assert result["base_release"] is None
    assert all(item["affects_fork_release"] is None for item in result["items"])


def test_the_base_release_is_the_highest_version_in_history_not_the_newest_by_date():
    releases = [release_pair("v1.7.0", "2026-09-30T00:00:00Z"), release_pair("v1.7.1", "2026-08-01T00:00:00Z"), release_pair("v1.6.0", "2026-07-01T00:00:00Z")]
    routes = {
        "repos/up/demo/releases?per_page=100": releases,
        f"{BASE}/compare/up:v1.7.1...v26.9.0": {"behind_by": 0},
        f"{BASE}/compare/up:v1.7.0...v26.9.0": {"behind_by": 0},
    }
    assert fork.fork_base_release(api_for(routes), BASE, "up/demo", None, "v26.9.0", fork.upstream_releases(api_for(routes), "up/demo"), "2026-10-01T00:00:00Z") == "v1.7.1"


def test_a_release_cut_from_a_side_branch_does_not_stop_the_search():
    releases = [release_pair("v2.0.0", "2026-09-30T00:00:00Z"), release_pair("v1.9.0", "2026-09-01T00:00:00Z")]
    routes = {
        "repos/up/demo/releases?per_page=100": releases,
        f"{BASE}/compare/up:v2.0.0...v26.9.0": {"behind_by": 12},
        f"{BASE}/compare/up:v1.9.0...v26.9.0": {"behind_by": 0},
    }
    assert fork.fork_base_release(api_for(routes), BASE, "up/demo", None, "v26.9.0", fork.upstream_releases(api_for(routes), "up/demo"), "2026-10-01T00:00:00Z") == "v1.9.0"


def test_releases_published_well_after_our_last_merge_are_not_base_candidates():
    releases = [release_pair(f"v1.{minor}.0", f"2026-{month:02d}-01T00:00:00Z") for minor, month in [(9, 10), (8, 9), (7, 6)]]
    routes = {"repos/up/demo/releases?per_page=100": releases, f"{BASE}/compare/up:v1.7.0...foss-main": {"behind_by": 0}}
    asked = []

    def api(path):
        asked.append(path)
        return routes.get(path)

    kept = fork.upstream_releases(api, "up/demo")
    assert fork.fork_base_release(api, BASE, "up/demo", None, "foss-main", kept, "2026-06-10T00:00:00Z") == "v1.7.0"
    assert not any("v1.9.0" in path or "v1.8.0" in path for path in asked)


GAP_ROUTES = {
    **ROUTES,
    f"{BASE}/compare/up:v1.5.0...v26.9.0": {"behind_by": 7},
    f"{BASE}/compare/up:v1.4.0...v26.9.0": {"behind_by": 0},
}


def test_a_known_base_release_puts_the_status_on_the_release_basis():
    record = collect({**GAP_ROUTES, f"{BASE}/compare/up:main...foss-main": {**ROUTES[f"{BASE}/compare/up:main...foss-main"], "behind_by": 5000}})
    assert record["release_gap"] == {"base": "v1.4.0", "base_ref": "v26.9.0", "latest": "v1.5.0", "releases_behind": 1, "level": "minor", "days_behind": 11}
    assert (record["status_basis"], record["status"]) == ("release", "lagging")


def test_on_the_release_basis_only_a_severe_advisory_affecting_our_base_is_critical():
    newer_but_fixed = [{"published_at": "2026-09-25T00:00:00Z", "severity": "high", "ghsa_id": "G", "vulnerabilities": [{"vulnerable_version_range": "< 1.4.0"}]}]
    record = collect({**GAP_ROUTES, "repos/up/demo/security-advisories?per_page=100": newer_but_fixed})
    assert record["status"] == "lagging"
    affecting = [{**newer_but_fixed[0], "vulnerabilities": [{"vulnerable_version_range": "<= 1.4.0"}]}]
    assert collect({**GAP_ROUTES, "repos/up/demo/security-advisories?per_page=100": affecting})["status"] == "critical"


def test_without_a_fork_release_the_base_is_found_from_the_production_branch():
    routes = {
        **ROUTES,
        f"{BASE}/tags?per_page=100": [],
        f"{BASE}/compare/up:v1.5.0...foss-main": {"behind_by": 3, "ahead_by": 1},
        f"{BASE}/compare/up:v1.4.0...foss-main": {"behind_by": 0},
    }
    record = collect(routes)
    assert record["fork_release"] is None
    assert (record["release_gap"]["base"], record["release_gap"]["base_ref"]) == ("v1.4.0", "foss-main")


def test_the_commit_basis_is_kept_when_no_base_release_is_found():
    record = collect()
    assert (record["release_gap"], record["status_basis"]) == (None, "commits")

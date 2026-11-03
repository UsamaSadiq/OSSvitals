import json
import re

import pytest
from jsonschema import ValidationError

from collectors import github
from collectors.fleet import inventory, pins
from collectors.fleet.repos import duplicate_repos, full_name
from collectors.fleet.settings import load_settings
from dashboard.lib.schema import validate_config_data
from scripts import collect_fleet

FORK = {"repo": "edx-platform", "class": "fork", "upstream": "openedx/openedx-platform", "upstream_branch": "master", "pin": "edly-21.0.1"}
DEPENDENCY = {"repo": "tutor", "class": "dependency", "owner": "overhangio", "pin": "v21.0.0"}


def api_for(responses):
    def api(path):
        return responses.get(path)

    return api


def refs(*names):
    return [{"ref": f"refs/tags/{name}", "object": {"sha": name, "type": "commit"}} for name in names]


def test_a_fork_pin_counts_our_newer_releases_from_every_tag_under_the_patterns_prefix():
    api = api_for({
        "repos/edly-io/edx-platform/git/matching-refs/tags/edly-21?per_page=100": refs("edly-21.0.0", "edly-21.0.1", "edly-21.0.3", "edly-21.0.2", "edly-21.0.3-rc1"),
        "repos/edly-io/edx-platform/compare/edly-21.0.1...edly-21.0.3": {"ahead_by": 12},
    })
    record = pins.pin_record(api, "edly-io", FORK, r"^edly-21\.\d+\.\d+$")
    assert record == {
        "repo": "edx-platform",
        "full_name": "edly-io/edx-platform",
        "class": "fork",
        "pin": "edly-21.0.1",
        "pin_kind": "tag",
        "pin_note": None,
        "latest_release": "edly-21.0.3",
        "releases_behind": 2,
        "commits_behind": 12,
        "status": "behind",
    }


def test_a_dependency_reads_its_own_owner_and_stable_tags():
    api = api_for({
        "repos/overhangio/tutor/tags?per_page=100": [{"name": "v21.0.0"}, {"name": "v20.0.4"}, {"name": "nightly"}],
    })
    record = pins.pin_record(api, "edly-io", DEPENDENCY, r"^edly-21\.\d+\.\d+$")
    assert (record["full_name"], record["latest_release"], record["releases_behind"], record["commits_behind"], record["status"]) == (
        "overhangio/tutor", "v21.0.0", 0, 0, "current",
    )


def test_a_branch_pin_is_counted_in_commits_not_releases():
    app = {**FORK, "pin": "develop-ulmo", "fork_release_tag": r"^edly-ulmo-v\d+\.\d+\.\d+$"}
    api = api_for({
        "repos/edly-io/edx-platform/git/matching-refs/tags/edly-ulmo-v?per_page=100": refs("edly-ulmo-v9.14.3"),
        "repos/edly-io/edx-platform/branches/develop-ulmo": {"name": "develop-ulmo"},
        "repos/edly-io/edx-platform/compare/develop-ulmo...edly-ulmo-v9.14.3": {"ahead_by": 0},
    })
    record = pins.pin_record(api, "edly-io", app, "unused")
    assert (record["pin_kind"], record["releases_behind"], record["commits_behind"], record["status"]) == ("branch", None, 0, "current")


def test_a_pin_without_any_release_is_unknown():
    api = api_for({"repos/overhangio/tutor/git/ref/tags/abc1234": None})
    record = pins.pin_record(api, "edly-io", {**DEPENDENCY, "pin": "abc1234"}, "unused")
    assert (record["latest_release"], record["pin_kind"], record["status"]) == (None, "commit", "unknown")


@pytest.mark.parametrize(
    ("latest", "releases_behind", "commits_behind", "expected"),
    [(None, None, None, "unknown"), ("v1", 0, 5, "current"), ("v1", 1, 0, "behind"), ("v1", None, 3, "behind"), ("v1", None, None, "unknown")],
)
def test_status_prefers_releases_over_commits(latest, releases_behind, commits_behind, expected):
    assert pins.status(latest, releases_behind, commits_behind) == expected


def test_an_app_owner_overrides_the_tenant_org_in_the_inventory():
    api = api_for({
        "repos/PakistanX/journal_xblock": {"html_url": "https://github.com/PakistanX/journal_xblock", "default_branch": "main", "pushed_at": "2026-10-01T00:00:00Z"},
    })
    app = {"repo": "journal_xblock", "class": "original", "owner": "PakistanX", "pin": "develop-ulmo"}
    record = inventory.collect_app(api, "edly-io", app, "develop-ulmo")
    assert (record["full_name"], record["pin"], record["production_branch"]) == ("PakistanX/journal_xblock", "develop-ulmo", None)
    assert full_name("edly-io", {"repo": "x"}) == "edly-io/x"


def test_repo_names_must_be_unique_across_owners():
    assert duplicate_repos([{"repo": "a"}, {"repo": "b", "owner": "o"}, {"repo": "a", "owner": "p"}]) == ["a"]


def test_the_pins_page_is_listed_only_when_an_app_is_pinned():
    settings = load_settings("moneta")
    assert collect_fleet.pages(settings, False) == settings.values["pages"]
    assert collect_fleet.pages(settings, True) == [*settings.values["pages"], "/pins"]


APPS = {"github_org": "edly-io"}


def test_the_schema_requires_an_owner_and_pin_for_a_dependency_and_no_fork_fields():
    validate_config_data("apps", {**APPS, "apps": [DEPENDENCY]}, strict=True)
    for broken in ({**DEPENDENCY, "owner": None}, {"repo": "tutor", "class": "dependency", "owner": "o"}, {**DEPENDENCY, "upstream": "a/b"}):
        with pytest.raises(ValidationError):
            validate_config_data("apps", {**APPS, "apps": [{key: value for key, value in broken.items() if value is not None}]}, strict=True)


def test_each_owner_reads_with_its_own_token(monkeypatch):
    monkeypatch.setenv(github.OWNER_TOKENS_ENV, json.dumps({"edly-io": "edly-token", "PakistanX": "pk-token"}))
    monkeypatch.setenv("GH_TOKEN", "default")
    assert github._env(("api", "repos/edly-io/x/tags"))["GH_TOKEN"] == "edly-token"
    assert github._env(("api", "repos/pakistanx/y"))["GH_TOKEN"] == "pk-token"
    assert github._env(("api", "graphql", "-f", "query=q", "-f", "owner=PakistanX"))["GH_TOKEN"] == "pk-token"
    assert github._env(("api", "repos/openedx/z")) is None
    assert github._env(("api", "users/someone")) is None


def test_no_owner_tokens_keeps_the_default_token(monkeypatch):
    monkeypatch.delenv(github.OWNER_TOKENS_ENV, raising=False)
    assert github._env(("api", "repos/edly-io/x")) is None


@pytest.mark.parametrize(
    ("pattern", "prefix"),
    [(r"^edly-21\.\d+$", "edly-21"), (r"^v?\d+(\.\d+)+$", ""), (r"^twenty/v\d+$", "twenty/v"), (r"^ab*c$", "a"), (r"^a|^b", ""), (r"v\d+", "")],
)
def test_the_tag_prefix_is_only_what_every_match_starts_with(pattern, prefix):
    assert pins._literal_prefix(re.compile(pattern)) == prefix

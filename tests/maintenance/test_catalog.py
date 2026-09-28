"""Catalog snapshot: parsing real catalog-info.yaml files and the findings they raise."""
from __future__ import annotations

from pathlib import Path

import pytest

from collectors import catalog

FIXTURES = Path(__file__).parent / "fixtures" / "catalog"


def _text(repo: str) -> str:
    return (FIXTURES / f"{repo}.yaml").read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def texts() -> dict[str, str | None]:
    files = {f"openedx/{path.stem}": path.read_text(encoding="utf-8") for path in FIXTURES.glob("*.yaml")}
    return {**files, "openedx/xss-utils": None}


@pytest.fixture(scope="module")
def by_repo(texts) -> dict[str, dict]:
    records = catalog.snapshot(texts, existing_users={"jajjibhai008"})
    return {entry["repo_name"]: entry for entry in records}


def test_record_reads_what_the_file_declares():
    entry = catalog.record("openedx/XBlock", _text("XBlock"))

    assert entry["entity_name"] == "XBlock"
    assert (entry["type"], entry["lifecycle"]) == ("library", "production")
    assert (entry["owner_kind"], entry["owner_name"]) == ("group", "axim-engineering")
    assert entry["arch_interest_groups"] == ["feanil"]
    assert entry["release"] is None
    assert [link["title"] for link in entry["links"]] == ["XBlock Docs", "XBlock Tutorial"]
    assert entry["backstage_url"] == "https://backstage.openedx.org/catalog/default/component/XBlock"


def test_blank_annotations_become_empty_values():
    entry = catalog.record("openedx/credentials", _text("credentials"))

    assert entry["arch_interest_groups"] == []
    assert entry["release"] == "master"
    assert (entry["owner_kind"], entry["owner_name"]) == ("user", "jajjibhai008")


def test_clean_file_has_no_findings(by_repo):
    assert by_repo["openedx/XBlock"]["findings"] == []
    assert by_repo["openedx/credentials"]["owner_status"] == catalog.USER_STATUS_EXISTS
    assert by_repo["openedx/XBlock"]["owner_status"] == catalog.USER_STATUS_UNCHECKED


def test_half_filled_file_is_flagged(by_repo):
    assert by_repo["openedx/openedx-core"]["findings"] == [
        "owner_unprefixed", "type_nonstandard", "lifecycle_nonstandard", "description_missing",
    ]


def test_missing_file_is_one_finding(by_repo):
    assert by_repo["openedx/xss-utils"] == {
        "repo_name": "openedx/xss-utils", "has_file": False, "findings": ["no_catalog_info"],
    }


def test_template_placeholders_are_not_counted_as_unknown_relations(by_repo):
    findings = by_repo["openedx/edx-enterprise-subsidy-client"]["findings"]

    assert "template_placeholders" in findings
    assert "relation_unknown" not in findings


def test_relations_to_undeclared_entities_are_flagged(by_repo):
    assert "relation_unknown" in by_repo["openedx/super-csv"]["findings"]
    assert "relation_unknown" in by_repo["openedx/course-discovery"]["findings"]


def test_relations_match_entity_names_case_insensitively():
    texts = {
        "openedx/a": "kind: Component\nmetadata: {name: Core}\nspec: {owner: 'group:x', type: library, lifecycle: production}",
        "openedx/b": (
            "kind: Component\nmetadata: {name: b, description: d}\n"
            "spec: {owner: 'group:x', type: library, lifecycle: production, dependsOn: ['component:core']}"
        ),
    }

    records = {entry["repo_name"]: entry for entry in catalog.snapshot(texts, existing_users=set())}

    assert "relation_unknown" not in records["openedx/b"]["findings"]


@pytest.mark.parametrize("text", ["", "   \n", "key: [unclosed", "- just\n- a list\n"])
def test_file_without_a_mapping_has_no_entity(text):
    entry = catalog.snapshot({"openedx/x": text}, existing_users=None)[0]

    assert entry["findings"] == ["no_entity"]


def test_missing_user_owner_is_flagged_and_unchecked_without_lookups():
    text = "kind: Component\nmetadata: {name: x, description: d}\nspec: {owner: 'user:ghost', type: library, lifecycle: production}"

    assert catalog.snapshot({"openedx/x": text}, existing_users=set())[0]["findings"] == ["owner_user_not_found"]
    assert catalog.snapshot({"openedx/x": text}, existing_users=None)[0]["owner_status"] == "unchecked"


def test_user_owner_logins_only_lists_users():
    entries = [catalog.record(repo, text) for repo, text in {
        "openedx/credentials": _text("credentials"), "openedx/XBlock": _text("XBlock"), "openedx/none": None,
    }.items()]

    assert catalog.user_owner_logins(entries) == {"jajjibhai008"}


def test_summary_counts_repos_files_and_problems(by_repo):
    result = catalog.summary(list(by_repo.values()))

    assert (result["repos"], result["with_file"]) == (8, 7)
    assert result["findings"]["no_catalog_info"] == 1
    assert result["with_problem"] == 5
    assert set(result["findings"]) == set(catalog.FINDINGS)

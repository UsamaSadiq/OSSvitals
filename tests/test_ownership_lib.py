"""Owner summary and per-owner repository lists."""
from __future__ import annotations

import pandas as pd

from dashboard.lib import ownership
from dashboard.lib.stewardship import NEEDS_MAINTAINER, SINGLE_PERSON, TEAM


def _repo(name, owner, kind, score, letter, lifecycle="production", release=""):
    return {
        "repo_name": name,
        "ownership.owner_name": owner,
        "ownership.owner_kind": kind,
        "score_composite": score,
        "score_letter": letter,
        "score_activity": 50.0,
        "ownership.lifecycle": lifecycle,
        "ownership.release": release,
    }


FRAME = pd.DataFrame(
    [
        _repo("openedx/a", "axim-engineering", "group", 80.0, "A"),
        _repo("openedx/b", "axim-engineering", "group", 30.0, "D", release="master"),
        _repo("openedx/c", "Axim-Engineering", "group", 60.0, "B"),
        _repo("openedx/d", "UsamaSadiq", "user", 90.0, "A"),
        _repo("openedx/e", "openedx-unmaintained", "group", 20.0, "D"),
        _repo("openedx/f", "", "", 70.0, "B"),
    ]
)


def _summary():
    return ownership.owner_summary(FRAME, unmaintained_group="openedx-unmaintained", at_risk_repos={"openedx/b"})


def test_owners_are_merged_case_insensitively_and_keep_first_spelling():
    summary = _summary()

    axim = summary[summary["owner_key"] == "axim-engineering"].iloc[0]
    assert axim["owner"] == "axim-engineering"
    assert axim["repo_count"] == 3


def test_summary_counts_and_types():
    rows = _summary().set_index("owner_key")

    assert rows.loc["axim-engineering", "avg_score"] == 56.7
    assert rows.loc["axim-engineering", "d_or_f"] == 1
    assert rows.loc["axim-engineering", "at_risk"] == 1
    assert rows.loc["axim-engineering", "owner_type"] == TEAM
    assert rows.loc["usamasadiq", "owner_type"] == SINGLE_PERSON
    assert rows.loc["openedx-unmaintained", "owner_type"] == NEEDS_MAINTAINER


def test_repos_without_an_owner_are_left_out():
    assert set(_summary()["owner_key"]) == {"axim-engineering", "usamasadiq", "openedx-unmaintained"}


def test_summary_is_ordered_by_repo_count_with_a_stable_positional_index():
    summary = _summary()

    assert list(summary.index) == [0, 1, 2]
    assert summary.iloc[0]["owner_key"] == "axim-engineering"


def test_repos_for_owner_matches_any_casing_and_sorts_weakest_first():
    repos = ownership.repos_for_owner(FRAME, "AXIM-engineering")

    assert list(repos["repo_name"]) == ["openedx/b", "openedx/c", "openedx/a"]
    assert list(repos.columns) == ["repo_name", "score_composite", "score_letter", "score_activity", "lifecycle", "release"]


def test_unknown_owner_has_no_repos():
    assert ownership.repos_for_owner(FRAME, "nobody").empty


def test_grade_mix_counts_every_band():
    mix = ownership.grade_mix(ownership.repos_for_owner(FRAME, "axim-engineering"))

    assert mix == {"A": 1, "B": 1, "C": 0, "D": 1, "F": 0}


def test_snapshot_without_ownership_columns_gives_empty_summary():
    bare = pd.DataFrame([{"repo_name": "x", "score_composite": 1.0, "score_letter": "F"}])

    assert ownership.owner_summary(bare, unmaintained_group="g", at_risk_repos=set()).empty
    assert ownership.repos_for_owner(bare, "g").empty


def test_owner_without_a_kind_is_labelled_not_stated():
    assert ownership.owner_type("2U-aperture", "unknown", unmaintained_group="openedx-unmaintained") == "not stated"


def test_ownership_coverage_counts_any_filled_owner_field():
    from dashboard.lib.ownership import ownership_coverage

    frame = pd.DataFrame({"ownership.owner": ["a", "", None, " "], "ownership.theme": [None, "t", None, None]})
    assert ownership_coverage(frame) == 50.0
    assert ownership_coverage(pd.DataFrame({"other": [1]})) == 0.0


def test_group_summary_buckets_blank_values_and_ranks_by_size():
    from dashboard.lib.ownership import group_summary

    frame = pd.DataFrame(
        {
            "repo_name": ["a", "b", "c"],
            "ownership.theme": ["x", "", "x"],
            "score_composite": [80.0, 10.0, 61.0],
            "score_letter": ["A", "F", "B"],
        }
    )
    summary = group_summary(frame, "ownership.theme")
    assert summary.to_dict("records") == [
        {"ownership.theme": "x", "repo_count": 2, "avg_score": 70.5, "d_or_f": 0},
        {"ownership.theme": "Unassigned", "repo_count": 1, "avg_score": 10.0, "d_or_f": 1},
    ]
    assert group_summary(frame, "missing").empty

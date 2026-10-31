import pytest

from collectors.fleet.status import DriftSignals, classify
from collectors.fleet.settings import load_settings

RULES = load_settings("moneta").statuses


def gap(releases_behind=0, level="none", days_behind=0):
    return {"base": "v1.0.0", "base_ref": "v26.9.0", "latest": "v1.0.0", "releases_behind": releases_behind, "level": level, "days_behind": days_behind}


@pytest.mark.parametrize(
    ("behind", "days", "advisory", "expected"),
    [
        (0, 400, False, "in-sync"),
        (10, 5, False, "in-sync"),
        (50, 5, False, "lagging"),
        (10, 30, False, "lagging"),
        (500, 5, False, "stale"),
        (10, 90, False, "stale"),
        (2000, 5, False, "critical"),
        (10, 180, False, "critical"),
        (1, 1, True, "critical"),
    ],
)
def test_without_a_known_base_release_commit_drift_decides(behind, days, advisory, expected):
    assert classify(RULES, DriftSignals(behind, days, advisory)) == expected


def test_unknown_age_does_not_trigger_the_age_thresholds():
    assert classify(RULES, DriftSignals(1, None, False)) == "in-sync"


@pytest.mark.parametrize(
    ("release_gap", "advisory", "expected"),
    [
        (gap(), False, "in-sync"),
        (gap(2, "patch", 40), False, "in-sync"),
        (gap(3, "patch", 40), False, "lagging"),
        (gap(1, "minor", 10), False, "lagging"),
        (gap(1, "patch", 90), False, "stale"),
        (gap(1, "major", 5), False, "stale"),
        (gap(), True, "critical"),
    ],
)
def test_with_a_known_base_release_release_drift_decides(release_gap, advisory, expected):
    assert classify(RULES, DriftSignals(5000, 400, advisory, release_gap)) == expected


def test_the_basis_names_which_thresholds_applied():
    assert (DriftSignals(0, 0, False).basis, DriftSignals(0, 0, False, gap()).basis) == ("commits", "release")


def test_without_advisories_a_fork_on_the_latest_release_is_not_critical_however_far_main_has_moved():
    from collectors.fleet.settings import DEFAULTS_PATH, build_settings
    from dashboard.lib.config import read_config_file

    without_advisories = build_settings("demo", read_config_file(DEFAULTS_PATH), {"signals": {"advisories": {"collect": False}}}).statuses
    assert classify(without_advisories, DriftSignals(5000, 400, False, gap(releases_behind=0))) == "in-sync"
    assert classify(without_advisories, DriftSignals(5000, 400, False, gap(releases_behind=1, level="major"))) == "stale"

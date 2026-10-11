import pytest

from collectors.moneta.status import classify
from dashboard.lib.config import read_config_file

RULES = read_config_file("config/moneta/status.yaml")["statuses"]


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
def test_any_met_threshold_wins_and_the_most_severe_is_chosen(behind, days, advisory, expected):
    assert classify(RULES, behind, days, advisory) == expected


def test_unknown_age_does_not_trigger_the_age_thresholds():
    assert classify(RULES, 1, None, False) == "in-sync"

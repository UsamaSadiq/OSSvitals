import pandas as pd
import pytest

from dashboard.lib.config import get_config
from dashboard.lib.precomputed import scored_snapshot
from dashboard.lib.scoring import calculate_scores, score_row
from dashboard.lib.proposed_scoring import applicable_config, grade_changes, grade_migration, swap_rows
from dashboard.lib.scoring_method import rule_text

PROPOSED = get_config("scoring_proposed")


def _metric_only(name: str, cfg: dict) -> dict:
    return {"version": "t", "metrics": {name: cfg}}


def _score(config: dict, **values) -> tuple[float, dict]:
    row = pd.Series(values)
    score = score_row(row, list(row.index), config=config)
    return score.composite, score.metric_confidence


@pytest.mark.parametrize(
    "state,expected,confidence",
    [("SUCCESS", 100.0, "measured"), ("FAILURE", 0.0, "measured"), ("ERROR", 0.0, "measured"),
     ("PENDING", 50.0, "defaulted")],
)
def test_ci_passing_scores_the_default_branch_state(state, expected, confidence):
    config = _metric_only("ci_status", PROPOSED["metrics"]["ci_status"])

    composite, confidences = _score(config, **{"github.default_branch_ci_state": state})

    assert composite == expected
    assert confidences["ci_status"] == confidence


@pytest.mark.parametrize(
    "owner,lifecycle,expected",
    [("openedx/wg", "production", 100.0), ("openedx/wg", None, 50.0), (None, None, 50.0)],
)
def test_catalog_info_valid_needs_owner_and_lifecycle(owner, lifecycle, expected):
    config = _metric_only("catalog_info_valid", PROPOSED["metrics"]["catalog_info_valid"])

    composite, _ = _score(config, **{"ownership.owner": owner, "ownership.lifecycle": lifecycle})

    assert composite == expected


@pytest.mark.parametrize("days,expected", [(10, 100.0), (60, 70.0), (200, 20.0), (400, 0.0)])
def test_lockfile_age_is_lower_is_better(days, expected):
    config = _metric_only("dependency_freshness", PROPOSED["metrics"]["dependency_freshness"])

    composite, _ = _score(config, **{"git.lockfile_age_days": days})

    assert composite == expected


def test_default_config_is_the_live_one():
    frame = pd.DataFrame([{"repo_name": "a", "github_actions": True}])

    assert calculate_scores(frame)["score_config_version"].iloc[0] == get_config("scoring")["version"]
    assert calculate_scores(frame, config=PROPOSED)["score_config_version"].iloc[0] == PROPOSED["version"]


def test_proposed_payload_for_the_live_version_is_not_used():
    raw = pd.DataFrame([{"repo_name": "a", "TIMESTAMP": "2026-09-27", "github.default_branch_ci_state": "SUCCESS"}])
    live_records = calculate_scores(raw)
    payload = {
        "metadata": {"schema_version": 1, "config_version": get_config("scoring")["version"],
                     "snapshot_timestamp": "2026-09-27"},
        "records": live_records[["repo_name", "score_composite", "score_config_version"]].to_dict("records"),
    }

    scored = scored_snapshot(raw, payload, config=PROPOSED)

    assert scored["score_config_version"].iloc[0] == PROPOSED["version"]


def test_swap_rows_flag_inputs_missing_from_the_snapshot():
    scored = calculate_scores(pd.DataFrame([{"repo_name": "a", "ownership.owner": "x"}]), config=PROPOSED)

    swaps = {row["metric"]: row for row in swap_rows(PROPOSED, scored)}

    assert set(swaps) == {"contributor absence factor", "ci status", "catalog info valid", "dependency freshness"}
    assert swaps["catalog info valid"]["in_snapshot"]
    assert not swaps["dependency freshness"]["in_snapshot"]
    assert swaps["dependency freshness"]["measured_pct"] is None
    assert swaps["catalog info valid"]["measured_pct"] == 100.0


def test_grade_migration_and_changes():
    live = pd.DataFrame({"repo_name": ["a", "b", "c"], "score_letter": ["A", "B", "C"],
                         "score_composite": [85.0, 65.0, 45.0]})
    proposed = live.assign(score_letter=["A", "C", "A"], score_composite=[85.0, 55.0, 82.0])

    table = grade_migration(live, proposed)
    changes = grade_changes(live, proposed)

    assert table.loc["B", "C"] == 1 and table.loc["C", "A"] == 1 and table.loc["A", "A"] == 1
    assert int(table.values.sum()) == 3
    assert changes["repo_name"].tolist() == ["c", "b"]
    assert changes["change"].tolist() == [37.0, -10.0]


def test_rule_text_for_new_rules():
    metrics = PROPOSED["metrics"]

    assert rule_text(metrics["ci_status"]) == "100 if SUCCESS, 0 if FAILURE or ERROR"
    assert "`ownership.lifecycle`" in rule_text(metrics["catalog_info_valid"])
    assert rule_text(metrics["dependency_freshness"]).endswith("older → 0")


def test_swaps_without_their_input_keep_the_live_metric():
    live = get_config("scoring")

    config = applicable_config(PROPOSED, live, ["ownership.owner", "github.default_branch_ci_state"])

    assert config["metrics"]["dependency_freshness"] == live["metrics"]["dependency_freshness"]
    assert config["metrics"]["contributor_absence_factor"] == live["metrics"]["contributor_absence_factor"]
    assert config["metrics"]["ci_status"] == PROPOSED["metrics"]["ci_status"]
    assert "catalog_info_valid" in config["metrics"] and "openedx_yaml_compliance" not in config["metrics"]
    assert config["version"] == PROPOSED["version"]


def test_all_inputs_absent_keeps_every_live_swapped_metric():
    live = get_config("scoring")

    config = applicable_config(PROPOSED, live, [])

    assert set(config["metrics"]) == set(live["metrics"])


def test_grade_changes_order_ties_by_repo_name():
    live = pd.DataFrame({"repo_name": ["z", "a", "m"], "score_letter": ["B", "B", "B"],
                         "score_composite": [75.0, 75.0, 75.0]})
    proposed = live.assign(score_letter=["A", "A", "C"], score_composite=[80.0, 80.0, 70.0])

    assert grade_changes(live, proposed)["repo_name"].tolist() == ["a", "m", "z"]

from __future__ import annotations

import pandas as pd

from dashboard.lib.repo_detail import (
    bar_letter,
    catalog_detail,
    category_card,
    metric_bars,
    metric_summary,
    owner_key_for_link,
    subscore,
)


def _row(**values) -> pd.Series:
    return pd.Series(values)


def test_metric_summary_warns_below_80_percent_weight():
    row = _row(score_per_metric={"a": 1, "b": 2}, score_unavailable_metrics=["c"], score_coverage=0.75)
    assert metric_summary(row) == {"available": 2, "total": 3, "coverage_pct": 75.0, "level": "warn"}


def test_subscore_withholds_below_half_measured_and_notes_partial_weight():
    assert subscore(None, 1.0, "Help.")["value"] is None
    withheld = subscore(70.0, 0.4, "Help.")
    assert withheld["value"] is None and "only 40%" in withheld["help"]
    partial = subscore(70.0, 0.75, "Help.")
    assert partial == {"value": 70.0, "help": "Help. 75% of this category's weight is measured."}
    assert subscore(70.0, 1.0, "Help.") == {"value": 70.0, "help": "Help."}


def test_metric_bars_order_measured_then_defaulted_then_missing():
    row = _row(
        score_per_metric={"low": 30.0, "high": 90.0, "fallback": 50.0},
        score_metric_confidence={"low": "measured", "high": "measured", "fallback": "defaulted"},
        score_unavailable_metrics=["gone"],
        score_per_metric_weight={"low": 0.1, "high": 0.2},
    )
    bars = metric_bars(row)
    assert [bar["metric"] for bar in bars] == ["high", "low", "fallback", "gone"]
    assert bars[0]["letter"] == "A" and bars[2]["weight"] is None and bars[3]["state"] == "unavailable"


def test_bar_letter_bands():
    assert [bar_letter(score) for score in (95, 79.9, 40, 20, 0)] == ["A", "B", "C", "D", "F"]


def test_category_card_levels():
    row = _row(a="True", b="True", c="True", d="True", e="False", f="n/a")
    assert category_card(row, ["a", "b", "c", "d", "e"])["level"] == "pass"
    assert category_card(row, ["a", "e"])["level"] == "warn"
    assert category_card(row, ["e"])["level"] == "fail"
    assert category_card(row, ["f"]) == {"pass": 0, "fail": 0, "na": 1, "pass_rate": None, "level": "unknown"}


def test_catalog_detail_defaults_and_owner_link():
    entry = {"has_file": True, "has_entity": True, "owner": "group:team-x", "owner_name": "Team-X", "owner_kind": "group"}
    detail = catalog_detail(entry, {})
    assert detail["owner_key"] == "team-x"
    assert (detail["type"], detail["lifecycle"], detail["release"], detail["interest"]) == (
        "not set", "not set", "no", "none listed",
    )
    assert owner_key_for_link({"owner_name": "x", "owner_kind": "unprefixed"}) is None


def test_metric_bars_break_score_ties_by_name():
    row = _row(
        score_per_metric={"zeta": 100.0, "alpha": 100.0, "mid": 100.0},
        score_metric_confidence={"zeta": "measured", "alpha": "measured", "mid": "measured"},
        score_unavailable_metrics=[],
    )
    assert [bar["metric"] for bar in metric_bars(row)] == ["alpha", "mid", "zeta"]

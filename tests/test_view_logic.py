from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from dashboard.lib.attention import attention_reasons, needing_attention
from dashboard.lib.checks import (
    category_columns,
    category_pass_rates,
    category_stats,
    check_columns,
    classify,
    coverage,
    failing_counts,
)
from dashboard.lib.overview import top_failing, top_movers

NOW = datetime(2026, 10, 2, tzinfo=timezone.utc)
RULES = {
    "critical_low_grade": {"enabled": True},
    "important_many_fails": {"enabled": True, "minimum_failing_checks": 2},
    "no_commits_90d": {"enabled": True, "days_without_commit": 90},
    "legacy_ci_signal": {"enabled": True},
}


def _frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "repo_name": ["a", "b", "c"],
            "exists.readme": ["True", "False", "False"],
            "readme.badge": ["False", "False", "True"],
            "github.last_push": ["2026-09-30 00:00:00", "2026-01-01 00:00:00", "2026-09-30 00:00:00"],
            "language_bytes.css": ["0", "0", "10"],
            "github_actions": ["True", "False", "True"],
            "travis_ci.active": ["False", "True", "False"],
        }
    )


def test_classify_strips_and_buckets():
    assert [classify(v) for v in [" True", "no", "maybe", None]] == ["pass", "fail", "unknown", "unknown"]


def test_check_columns_skip_prefixes_are_explicit():
    cols = _frame().columns
    assert check_columns(cols) == ["exists.readme", "readme.badge", "travis_ci.active"]
    assert "language_bytes.css" in check_columns(cols, skip_prefixes=("github.",))


def test_failing_counts_orders_by_count_then_name():
    frame = _frame()
    result = failing_counts(frame, ["readme.badge", "exists.readme", "travis_ci.active"])
    assert result.to_dict("records") == [
        {"check": "exists.readme", "failing": 2},
        {"check": "readme.badge", "failing": 2},
        {"check": "travis_ci.active", "failing": 2},
    ]


def test_failing_counts_empty_when_all_pass():
    frame = pd.DataFrame({"exists.x": ["True"]})
    assert failing_counts(frame, ["exists.x"]).empty


def test_top_failing_keeps_language_bytes():
    assert "language_bytes.css" in top_failing(_frame())["check"].tolist()


def test_category_columns_require_a_dot():
    cats = category_columns(_frame().columns)
    assert cats["CI / Tooling"] == ["travis_ci.active"]
    assert cats["README"] == ["readme.badge"]


def test_category_pass_rates_include_undotted_columns():
    rates = category_pass_rates(_frame()).set_index("category")["pass_rate"]
    assert rates["CI / Tooling"] == round(3 / 6 * 100, 2)


def test_category_stats_counts_buckets():
    row = pd.Series({"x.a": "True", "x.b": "False", "x.c": ""})
    assert category_stats(row, ["x.a", "x.b", "x.c"]) == (1, 1, 1)


def test_coverage_ignores_unknown_values_in_pass_rate():
    assert coverage(pd.Series(["True", "False", "n/a", None])) == (75.0, 50.0)
    assert coverage(pd.Series(["n/a"])) == (100.0, None)


def test_attention_reasons_apply_each_enabled_rule():
    row = _frame().iloc[1]
    reasons = attention_reasons(row, "important", RULES, fail_columns=["exists.readme", "readme.badge"], now=NOW)
    assert reasons == [
        "important tier with 5+ failing checks",
        "no commits in 90+ days",
        "legacy CI signal: travis active but github_actions false",
    ]


def test_attention_reasons_skip_disabled_rules():
    row = _frame().iloc[1]
    assert attention_reasons(row, "important", {}, fail_columns=["exists.readme"], now=NOW) == []


def test_needing_attention_filters_tier_and_ranks():
    frame = _frame().assign(repo_tier=["critical", "important", "critical"], score_composite=[10.0, 50.0, 5.0], score_letter=["F", "C", "F"])
    result = needing_attention(frame, RULES, {}, now=NOW)
    assert result["repo_name"].tolist() == ["c", "a", "b"]
    assert needing_attention(frame, RULES, {}, now=NOW, tier_filter="standard").empty


def test_top_movers_against_baseline():
    frame = pd.DataFrame({"repo_name": ["a", "b"], "score_composite": [60.0, 40.0]})
    baseline = pd.DataFrame({"repo_name": ["a", "b"], "score_composite": [50.0, 45.0]})
    assert top_movers(frame, baseline)[["repo_name", "delta"]].to_dict("records") == [
        {"repo_name": "a", "delta": 10.0},
        {"repo_name": "b", "delta": -5.0},
    ]
    assert top_movers(frame, None).empty

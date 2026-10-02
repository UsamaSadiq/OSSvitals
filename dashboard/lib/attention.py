"""Rules from ``attention_rules.yaml`` that flag a repository for attention."""
from __future__ import annotations

from datetime import datetime

import pandas as pd

from dashboard.lib.checks import FAIL_TOKENS, check_columns
from dashboard.lib.ordering import rank
from dashboard.lib.schema import parse_last_push_utc
from dashboard.lib.tiers import TIER_COL, repo_tier

TRUE_TOKENS = {"true", "1", "yes"}
ATTENTION_COLUMNS = ["repo_name", TIER_COL, "score_composite", "score_letter", "reasons"]


def _enabled(rules: dict, name: str) -> dict | None:
    rule = rules.get(name, {})
    return rule if rule.get("enabled") else None


def _is_true(value: object) -> bool:
    return str(value).strip().lower() in TRUE_TOKENS


def _failing_check_count(row: pd.Series, columns: list[str]) -> int:
    return sum(str(row.get(col, "")).strip().lower() in FAIL_TOKENS for col in columns)


def attention_reasons(row: pd.Series, tier: str, rules: dict, *, fail_columns: list[str], now: datetime) -> list[str]:
    reasons: list[str] = []

    if _enabled(rules, "critical_low_grade") and tier == "critical" and row.get("score_letter") in {"D", "F"}:
        reasons.append("critical tier with D/F grade")

    many_fails = _enabled(rules, "important_many_fails")
    if many_fails and tier == "important":
        if _failing_check_count(row, fail_columns) >= int(many_fails.get("minimum_failing_checks", 5)):
            reasons.append("important tier with 5+ failing checks")

    stale = _enabled(rules, "no_commits_90d")
    if stale:
        last_push = parse_last_push_utc(row.get("github.last_push"))
        if last_push and (now - last_push).days >= int(stale.get("days_without_commit", 90)):
            reasons.append("no commits in 90+ days")

    legacy_ci = _enabled(rules, "legacy_ci_signal")
    if legacy_ci:
        travis_active = _is_true(row.get(legacy_ci.get("travis_ci_active_column", "travis_ci.active"), ""))
        gha_active = _is_true(row.get(legacy_ci.get("github_actions_column", "github_actions"), ""))
        if travis_active and not gha_active:
            reasons.append("legacy CI signal: travis active but github_actions false")

    return reasons


def needing_attention(
    df: pd.DataFrame,
    rules: dict,
    tiers_config: dict,
    *,
    now: datetime,
    tier_filter: str = "all",
) -> pd.DataFrame:
    """Flagged repositories with their reasons, most urgent tier and lowest score first."""
    fail_columns = check_columns(df.columns)
    rows = []
    for _, row in df.iterrows():
        repo = str(row.get("repo_name", ""))
        tier = str(row.get(TIER_COL) or repo_tier(repo, tiers_config))
        if tier_filter != "all" and tier != tier_filter:
            continue
        reasons = attention_reasons(row, tier, rules, fail_columns=fail_columns, now=now)
        if reasons:
            rows.append(
                {
                    "repo_name": repo,
                    TIER_COL: tier,
                    "score_composite": row.get("score_composite"),
                    "score_letter": row.get("score_letter"),
                    "reasons": "; ".join(reasons),
                }
            )
    if not rows:
        return pd.DataFrame(columns=ATTENTION_COLUMNS)
    return rank(pd.DataFrame(rows), [TIER_COL, "score_composite"], ascending=[True, True])

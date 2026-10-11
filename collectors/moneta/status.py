from __future__ import annotations

from typing import Any


def _meets(rule: dict[str, Any], behind: int, days: int | None, has_new_advisory: bool) -> bool:
    return any(
        (
            "min_behind" in rule and behind >= rule["min_behind"],
            "min_days_since_upstream_merge" in rule and behind > 0 and days is not None and days >= rule["min_days_since_upstream_merge"],
            bool(rule.get("on_advisory_newer_than_release")) and has_new_advisory,
        )
    )


def classify(rules: list[dict[str, Any]], behind: int, days: int | None, has_new_advisory: bool) -> str:
    """Most severe status whose thresholds are met on any signal; the first rule is the floor.

    Age only counts while upstream has commits the fork lacks.
    """
    for rule in reversed(rules[1:]):
        if _meets(rule, behind, days, has_new_advisory):
            return rule["key"]
    return rules[0]["key"]

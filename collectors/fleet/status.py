from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from collectors.fleet.release_gap import GAP_LEVELS


@dataclass(frozen=True)
class DriftSignals:
    behind: int
    days: int | None
    severe_advisory: bool
    gap: dict[str, Any] | None = None

    @property
    def basis(self) -> str:
        return "release" if self.gap else "commits"


def _commits_meet(rule: dict[str, Any], behind: int, days: int | None) -> bool:
    return any(
        (
            "min_behind" in rule and behind >= rule["min_behind"],
            "min_days_since_upstream_merge" in rule and behind > 0 and days is not None and days >= rule["min_days_since_upstream_merge"],
        )
    )


def _release_meets(rule: dict[str, Any], gap: dict[str, Any]) -> bool:
    return any(
        (
            "min_releases_behind" in rule and gap["releases_behind"] >= rule["min_releases_behind"],
            "min_version_gap" in rule and GAP_LEVELS.index(gap["level"]) >= GAP_LEVELS.index(rule["min_version_gap"]),
            "min_days_behind_release" in rule and gap["releases_behind"] > 0 and gap["days_behind"] >= rule["min_days_behind_release"],
        )
    )


def _meets(rule: dict[str, Any], signals: DriftSignals) -> bool:
    drift = _release_meets(rule, signals.gap) if signals.gap else _commits_meet(rule, signals.behind, signals.days)
    return drift or (bool(rule.get("on_severe_advisory")) and signals.severe_advisory)


def classify(rules: list[dict[str, Any]], signals: DriftSignals) -> str:
    """Most severe status whose thresholds are met; the first rule is the floor.

    Release thresholds apply when the upstream release we are built on is known, commit thresholds otherwise.
    Age only counts while upstream has something the fork lacks.
    """
    for rule in reversed(rules[1:]):
        if _meets(rule, signals):
            return rule["key"]
    return rules[0]["key"]

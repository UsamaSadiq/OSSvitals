"""Per-repository rules the Repo Detail page applies on top of the scores.

Shared by the Streamlit page and the views builder so both show the same
coverage chip, withheld sub-scores, metric order and category levels.
"""
from __future__ import annotations

from typing import Any

import pandas as pd

from dashboard.lib import catalog
from dashboard.lib.checks import category_stats

COVERAGE_WARN_BELOW = 80
SUBSCORE_MIN_MEASURED = 0.5
CARD_PASS_AT = 80
CARD_WARN_AT = 50
STATE_ORDER = {"measured": 0, "defaulted": 1, "unavailable": 2}
SUBSCORE_HELP = {
    "structural": "Baseline compliance: README, CI, openedx.yaml, deps.",
    "activity": "Commit recency, PR response time, PR closure ratio, release frequency and contributor signals.",
}
RELATION_STATUS_SUFFIX = {"not_in_catalog": " (not in catalog)", "placeholder": " (template placeholder)"}


def _mapping(value: object) -> dict:
    return dict(value) if isinstance(value, dict) else {}


def _sequence(value: object) -> list:
    return list(value) if isinstance(value, (list, tuple)) else []


def metric_summary(row: pd.Series) -> dict[str, Any]:
    available = len(_mapping(row.get("score_per_metric")))
    total = available + len(_sequence(row.get("score_unavailable_metrics")))
    coverage_pct = float(row.get("score_coverage", 0.0) or 0.0) * 100
    return {
        "available": available,
        "total": total,
        "coverage_pct": coverage_pct,
        "level": "warn" if coverage_pct < COVERAGE_WARN_BELOW else "pass",
    }


def subscore(value: object, fraction: float, base_help: str) -> dict[str, Any]:
    """A sub-score, or None with the reason when too little of its weight is measured."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return {"value": None, "help": f"{base_help} Not computable from this snapshot."}
    if fraction < SUBSCORE_MIN_MEASURED:
        return {
            "value": None,
            "help": (
                f"{base_help} Withheld: only {fraction:.0%} of this category's weight is measured, "
                "so the number would be mostly the fixed default of 50."
            ),
        }
    suffix = "" if fraction > 0.999 else f" {fraction:.0%} of this category's weight is measured."
    return {"value": float(value), "help": base_help + suffix}


def subscores(row: pd.Series) -> dict[str, dict[str, Any]]:
    measured = _mapping(row.get("score_category_measured_weight"))
    return {
        category: subscore(row.get(f"score_{category}"), float(measured.get(category, 1.0) or 0.0), base_help)
        for category, base_help in SUBSCORE_HELP.items()
    }


def bar_letter(score: float) -> str:
    """Grade band for a 0-100 metric score, for colouring a single bar."""
    if score >= 80:
        return "A"
    if score >= 60:
        return "B"
    if score >= 40:
        return "C"
    if score >= 20:
        return "D"
    return "F"


def metric_bars(row: pd.Series) -> list[dict[str, Any]]:
    """Measured metrics first by score, then defaulted, then not collected."""
    per_metric = _mapping(row.get("score_per_metric"))
    confidence = _mapping(row.get("score_metric_confidence"))
    weights = _mapping(row.get("score_per_metric_weight"))
    unavailable = set(_sequence(row.get("score_unavailable_metrics")))

    def state(name: str) -> str:
        return confidence.get(name, "measured" if name in per_metric else "unavailable")

    def order(name: str) -> tuple[int, float]:
        return (STATE_ORDER.get(state(name), 3), -float(per_metric.get(name, 0.0)))

    return [
        {
            "metric": name,
            "state": state(name),
            "score": float(per_metric.get(name, 0.0)),
            "weight": weights.get(name) if isinstance(weights.get(name), (int, float)) else None,
            "letter": bar_letter(float(per_metric.get(name, 0.0))),
        }
        for name in sorted(set(per_metric) | unavailable, key=order)
    ]


def category_card(row: pd.Series, columns: list[str]) -> dict[str, Any]:
    passed, failed, unknown = category_stats(row, columns)
    total = passed + failed
    pass_rate = passed / total * 100 if total else None
    if pass_rate is None:
        level = "unknown"
    elif pass_rate >= CARD_PASS_AT:
        level = "pass"
    elif pass_rate >= CARD_WARN_AT:
        level = "warn"
    else:
        level = "fail"
    return {"pass": passed, "fail": failed, "na": unknown, "pass_rate": pass_rate, "level": level}


def owner_key_for_link(entry: dict[str, Any]) -> str | None:
    name = entry.get("owner_name")
    if not name or entry.get("owner_kind") == "unprefixed":
        return None
    return str(name).lower()


def relation_lines(entry: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {
            "label": catalog.RELATIONS.get(relation["relation"], relation["relation"]),
            "target": relation["target"],
            "suffix": RELATION_STATUS_SUFFIX.get(relation["status"], ""),
        }
        for relation in entry.get("relations") or []
    ]


def catalog_detail(entry: dict[str, Any], findings_legend: dict[str, dict[str, str]]) -> dict[str, Any]:
    """What the Repo Detail catalog panel shows for one catalog record."""
    return {
        "has_file": bool(entry.get("has_file")),
        "has_entity": bool(entry.get("has_entity")),
        "owner": entry.get("owner") or "not set",
        "owner_key": owner_key_for_link(entry),
        "type": entry.get("type") or "not set",
        "lifecycle": entry.get("lifecycle") or "not set",
        "release": entry.get("release") or "no",
        "interest": ", ".join(entry.get("arch_interest_groups") or []) or "none listed",
        "description": entry.get("description") or None,
        "links": [{"title": link["title"], "url": link["url"]} for link in entry.get("links") or []],
        "relations": relation_lines(entry),
        "backstage_url": entry.get("backstage_url") or None,
        "findings": [
            {"severity": severity, "label": label}
            for severity, label in catalog.finding_labels(entry, findings_legend)
        ],
    }

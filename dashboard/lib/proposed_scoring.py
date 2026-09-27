"""The proposed scoring method, shown beside the live one for Maintenance WG review.

``scoring_proposed.yaml`` swaps some metrics for outcome measures. A swap applies
only once the snapshot carries its input column; until then the live metric keeps
its slot, so the comparison shows the effect of the swaps that can be measured
instead of re-weighting the rest.
"""
from __future__ import annotations

from typing import Any

import pandas as pd

from dashboard.lib.schema import REPO_COL
from dashboard.lib.scoring_method import metric_rows

GRADE_ORDER = ["A", "B", "C", "D", "F"]


def _replaced_metric(name: str, cfg: dict[str, Any]) -> str:
    return str(cfg.get("replaces_metric", name))


def applicable_config(proposed: dict[str, Any], live: dict[str, Any], columns: list[str]) -> dict[str, Any]:
    """Proposed config with each swap whose input is absent reverted to the live metric."""
    live_metrics = live.get("metrics", {})
    metrics: dict[str, Any] = {}
    for name, cfg in proposed.get("metrics", {}).items():
        replaced = _replaced_metric(name, cfg)
        if cfg.get("replaces") and cfg.get("column") not in columns and replaced in live_metrics:
            metrics[replaced] = live_metrics[replaced]
        else:
            metrics[name] = cfg
    return {**proposed, "metrics": metrics}


def swap_rows(proposed: dict[str, Any], proposed_scored: pd.DataFrame) -> list[dict[str, Any]]:
    """The metrics the proposed method replaces, and whether the snapshot carries their new input yet."""
    metrics = proposed.get("metrics", {})
    rows = metric_rows(proposed, proposed_scored)
    swaps = []
    for cfg, row in zip(metrics.values(), rows):
        if not cfg.get("replaces"):
            continue
        in_snapshot = row["source"] in proposed_scored.columns
        swaps.append(
            {
                "metric": row["metric"],
                "replaces": str(cfg["replaces"]),
                "source": row["source"],
                "rule": row["rule"],
                "in_snapshot": in_snapshot,
                "measured_pct": row["measured_pct"] if in_snapshot else None,
            }
        )
    return swaps


def _letters(live: pd.DataFrame, proposed: pd.DataFrame) -> pd.DataFrame:
    columns = [REPO_COL, "score_letter", "score_composite"]
    if not set(columns) <= set(live.columns) or not set(columns) <= set(proposed.columns):
        return pd.DataFrame(columns=[REPO_COL, "current", "proposed", "current_score", "proposed_score"])
    joined = live[columns].merge(proposed[columns], on=REPO_COL, suffixes=("_live", "_proposed"))
    return joined.rename(
        columns={
            "score_letter_live": "current",
            "score_letter_proposed": "proposed",
            "score_composite_live": "current_score",
            "score_composite_proposed": "proposed_score",
        }
    )


def grade_migration(live: pd.DataFrame, proposed: pd.DataFrame) -> pd.DataFrame:
    """Repo counts by current grade (rows) and proposed grade (columns)."""
    letters = _letters(live, proposed)
    table = pd.crosstab(letters["current"], letters["proposed"])
    table = table.reindex(index=GRADE_ORDER, columns=GRADE_ORDER, fill_value=0)
    table.index.name = "Current grade"
    table.columns.name = "Proposed grade"
    return table


def grade_changes(live: pd.DataFrame, proposed: pd.DataFrame) -> pd.DataFrame:
    """Repos whose letter grade would change, largest score movement first."""
    letters = _letters(live, proposed)
    changed = letters[letters["current"] != letters["proposed"]].copy()
    changed["change"] = (changed["proposed_score"] - changed["current_score"]).round(1)
    return changed.sort_values("change", key=abs, ascending=False).reset_index(drop=True)

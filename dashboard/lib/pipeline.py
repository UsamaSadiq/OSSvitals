"""Load and score one org's data once, for every script that publishes files.

``build_scores.py`` and ``build_views.py`` both start here, so ``scores.json`` and
``views/repos.json`` can never disagree about a number.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from dashboard.lib.config import DEFAULT_ORG, get_config
from dashboard.lib.data import DEFAULT_CSV_URL, load_snapshot
from dashboard.lib.proposed_scoring import applicable_config
from dashboard.lib.scoring import calculate_scores
from dashboard.lib.tiers import annotate_tiers
from dashboard.lib.trends import Snapshot, load_history


@dataclass(frozen=True)
class ScoredOrg:
    org: str
    snapshot: pd.DataFrame
    scored: pd.DataFrame
    proposed: pd.DataFrame
    history: list[Snapshot]
    snapshot_url: str
    history_url: str


def _source_urls(data_source: dict) -> tuple[str, str]:
    snapshot_url = data_source.get("csv_url", DEFAULT_CSV_URL)
    history_url = data_source.get("history_csv_url") or snapshot_url.replace(
        "dashboard_main.csv", "dashboard_history.csv"
    )
    return snapshot_url, history_url


def score_org(org: str = DEFAULT_ORG) -> ScoredOrg:
    scoring = get_config("scoring", org)
    snapshot = annotate_tiers(load_snapshot(org), get_config("tiers", org))
    proposed_config = applicable_config(get_config("scoring_proposed", org), scoring, list(snapshot.columns))
    history = [
        Snapshot(timestamp=item.timestamp, df=calculate_scores(item.df, config=scoring))
        for item in load_history(org=org)
    ]
    snapshot_url, history_url = _source_urls(get_config("data_source", org))
    return ScoredOrg(
        org=org,
        snapshot=snapshot,
        scored=calculate_scores(snapshot, config=scoring),
        proposed=calculate_scores(snapshot, config=proposed_config),
        history=history,
        snapshot_url=snapshot_url,
        history_url=history_url,
    )

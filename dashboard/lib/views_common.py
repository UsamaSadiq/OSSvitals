"""Envelope, context and history windows shared by every views builder."""
from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

import pandas as pd

from dashboard.lib.config import get_config
from dashboard.lib.pipeline import ScoredOrg
from dashboard.lib.schema import TIMESTAMP_COL
from dashboard.lib.trends import Snapshot

SCHEMA_VERSION = 1


@dataclass(frozen=True)
class BuildContext:
    data: ScoredOrg
    generated_at: datetime
    commit_sha: str = "local"
    maintenance: Mapping[str, dict[str, Any] | None] = field(default_factory=dict)

    @property
    def org(self) -> str:
        return self.data.org

    def config(self, section: str) -> dict[str, Any]:
        return get_config(section, self.org)


def records(df: pd.DataFrame) -> list[dict[str, Any]]:
    if df.empty:
        return []
    return json.loads(df.to_json(orient="records", date_format="iso"))


def _iso(value: date | None) -> str | None:
    return value.isoformat() if value else None


def _snapshot_timestamp(scored: pd.DataFrame) -> str | None:
    if scored.empty or TIMESTAMP_COL not in scored.columns:
        return None
    return str(scored[TIMESTAMP_COL].iloc[0])


def window(history: list[Snapshot], days: int) -> list[Snapshot]:
    """Snapshots within ``days`` of the latest, as ``load_history(days=...)`` selects them."""
    if not history:
        return []
    cutoff = history[-1].timestamp - timedelta(days=days)
    return [snapshot for snapshot in history if snapshot.timestamp >= cutoff]


def baseline_of(history: list[Snapshot], days: int) -> Snapshot | None:
    selected = window(history, days)
    return selected[0] if len(selected) >= 2 else None


def envelope(ctx: BuildContext, source: str, **fields: Any) -> dict[str, Any]:
    return {
        "metadata": {
            "schema_version": SCHEMA_VERSION,
            "org": ctx.org,
            "generated_at": ctx.generated_at.isoformat(),
            "snapshot_timestamp": _snapshot_timestamp(ctx.data.scored),
            "source": source,
        },
        **fields,
    }



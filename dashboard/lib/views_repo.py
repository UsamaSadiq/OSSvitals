"""Per-repository detail for the Repo Detail page."""
from __future__ import annotations

from typing import Any

import pandas as pd

from dashboard.lib import catalog
from dashboard.lib.checks import category_columns
from dashboard.lib.repo_detail import catalog_detail, category_card, metric_bars, metric_summary, subscores
from dashboard.lib.schema import REPO_COL
from dashboard.lib.views_common import BuildContext, envelope


def _catalog_by_repo(payload: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    if payload is None:
        return {}
    findings_legend = catalog.legend(payload)
    return {entry[REPO_COL]: catalog_detail(entry, findings_legend) for entry in payload["records"]}


def _repo_entry(row: pd.Series, categories: dict[str, list[str]], catalog_entry: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "summary": metric_summary(row),
        "subscores": subscores(row),
        "metric_bars": metric_bars(row),
        "category_cards": [{"name": name, **category_card(row, cols)} for name, cols in categories.items()],
        "catalog": catalog_entry,
    }


def build_repo_detail(ctx: BuildContext) -> dict[str, Any]:
    scored = ctx.data.scored
    payload = ctx.maintenance.get(catalog.CATALOG_FILE)
    entries = _catalog_by_repo(payload)
    categories = {name: cols for name, cols in category_columns(scored.columns).items() if cols}
    return envelope(
        ctx,
        "scores, checks and catalog-info.yaml snapshot",
        catalog_available=payload is not None,
        catalog_collected_at=payload["metadata"].get("generated_at") if payload else None,
        repos={
            str(row[REPO_COL]): _repo_entry(row, categories, entries.get(str(row[REPO_COL])))
            for _, row in scored.iterrows()
        },
    )

"""Per-repository detail for the Repo Detail page."""
from __future__ import annotations

from typing import Any

import pandas as pd

from collectors import fix_prs
from dashboard.lib import catalog, maintenance
from dashboard.lib.checks import category_columns
from dashboard.lib.repo_detail import catalog_detail, category_card, metric_bars, metric_summary, subscores
from dashboard.lib.schema import REPO_COL
from dashboard.lib.views_common import BuildContext, envelope


def _catalog_by_repo(payload: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    if payload is None:
        return {}
    findings_legend = catalog.legend(payload)
    return {entry[REPO_COL]: catalog_detail(entry, findings_legend) for entry in payload["records"]}


def _repo_entry(
    row: pd.Series,
    categories: dict[str, list[str]],
    catalog_entry: dict[str, Any] | None,
    subscore_help: dict[str, str],
    open_fix_prs: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    return {
        "summary": metric_summary(row),
        "subscores": subscores(row, subscore_help),
        "metric_bars": metric_bars(row),
        "category_cards": [{"name": name, **category_card(row, cols)} for name, cols in categories.items()],
        "catalog": catalog_entry,
        "fix_prs": {check: _fix_pr_entry(entry) for check, entry in open_fix_prs.items()},
    }


FIX_PR_FIELDS = ("pr_number", "pr_url", "pr_title", "author", "is_draft", "created_at", "open_count")


def _fix_pr_entry(entry: dict[str, Any]) -> dict[str, Any]:
    return {field: entry.get(field) for field in FIX_PR_FIELDS}


def _fix_prs_by_repo(payload: dict[str, Any] | None) -> dict[str, dict[str, dict[str, Any]]]:
    return fix_prs.by_repo_and_check(payload["records"]) if payload else {}


def build_repo_detail(ctx: BuildContext) -> dict[str, Any]:
    scored = ctx.data.scored
    payload = ctx.maintenance.get(catalog.CATALOG_FILE)
    entries = _catalog_by_repo(payload)
    categories = {name: cols for name, cols in category_columns(scored.columns).items() if cols}
    subscore_help = ctx.config("strings").get("subscore_help", {})
    fix_payload = ctx.maintenance.get(maintenance.FIX_PRS)
    open_fix_prs = _fix_prs_by_repo(fix_payload)
    return envelope(
        ctx,
        "scores, checks, catalog-info.yaml snapshot and open remediation PRs",
        catalog_available=payload is not None,
        catalog_collected_at=payload["metadata"].get("generated_at") if payload else None,
        fix_prs_collected_at=fix_payload["metadata"].get("generated_at") if fix_payload else None,
        repos={
            str(row[REPO_COL]): _repo_entry(
                row, categories, entries.get(str(row[REPO_COL])), subscore_help, open_fix_prs.get(str(row[REPO_COL]), {})
            )
            for _, row in scored.iterrows()
        },
    )

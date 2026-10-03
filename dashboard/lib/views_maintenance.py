"""Views built from the collect-maintenance files: Components and Upgrades."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from dashboard.lib import catalog, maintenance
from dashboard.lib.schema import REPO_COL
from dashboard.lib.upgrades import done_rule, gaps
from dashboard.lib.views_common import BuildContext, envelope, records

CATALOG_KEY = catalog.CATALOG_FILE
COMPONENT_FIELDS = [
    REPO_COL, "has_file", "type", "lifecycle", "owner", "release",
    "score_letter", "score_composite", "finding_count", "backstage_url",
]
UPGRADE_JOB_FIELDS = [
    REPO_COL, "state", "reason", "github.upgrade_job_runs_failed", "github.upgrade_job_runs_total",
    "github.requirements_pr_last_merged", "workflow_url",
]
WAVE_RECORD_FIELDS = [REPO_COL, "status", "pr_url", "pr_title", "pr_age_days"]
REDUNDANT_FIELDS = [REPO_COL, "bot_pr_url", "superseded_by_url", "superseded_by_merged", "confidence"]


def maintenance_keys(waves_config: dict[str, Any]) -> list[str]:
    return [
        catalog.CATALOG_FILE,
        maintenance.UPGRADE_JOBS,
        maintenance.REDUNDANT_PRS,
        *(maintenance.wave_file(wave_id) for wave_id in waves_config),
    ]


def _generated(payload: dict[str, Any]) -> str | None:
    return payload["metadata"].get("generated_at")


def _present(frame: pd.DataFrame, fields: list[str]) -> pd.DataFrame:
    return frame[[field for field in fields if field in frame.columns]]


def _finding_rows(payload: dict[str, Any], components: pd.DataFrame) -> list[dict[str, Any]]:
    by_repo = components.set_index(REPO_COL)
    return [
        {
            **row,
            "repos": records(
                by_repo.loc[[repo for repo in row["repos"] if repo in by_repo.index], ["score_letter", "owner"]]
                .reset_index()
            ),
        }
        for row in catalog.finding_rows(payload)
    ]


def build_components(ctx: BuildContext) -> dict[str, Any]:
    payload = ctx.maintenance.get(CATALOG_KEY)
    if payload is None:
        return envelope(ctx, "catalog-info.yaml snapshot", available=False)
    components = catalog.components_frame(payload, ctx.data.scored)
    return envelope(
        ctx,
        "catalog-info.yaml snapshot",
        available=True,
        collected_at=_generated(payload),
        summary=payload["metadata"].get("summary") or {},
        findings=_finding_rows(payload, components),
        components=records(_present(components, COMPONENT_FIELDS)),
        relations=catalog.relation_rows(payload),
    )


def _upgrade_jobs(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if payload is None:
        return None
    return {
        "collected_at": _generated(payload),
        "states": payload["metadata"].get("states", {}),
        "records": records(_present(pd.DataFrame(payload["records"]), UPGRADE_JOB_FIELDS)),
    }


def _wave_records(payload: dict[str, Any]) -> list[dict[str, Any]]:
    frame = pd.DataFrame(payload["records"])
    if frame.empty:
        return []
    with_gaps = frame.assign(
        gaps=[gaps(missing, leftover) for missing, leftover in zip(frame.get("missing", []), frame.get("leftover", []))]
    )
    return records(_present(with_gaps, [*WAVE_RECORD_FIELDS, "gaps"]))


def _wave(wave_id: str, wave: dict[str, Any], payload: dict[str, Any] | None) -> dict[str, Any]:
    base = {"id": wave_id, "title": wave.get("title", wave_id), "epic": wave.get("epic"), "done_rule": done_rule(wave)}
    if payload is None:
        return {**base, "available": False}
    return {
        **base,
        "available": True,
        "collected_at": _generated(payload),
        "summary": payload["metadata"].get("summary", {}),
        "records": _wave_records(payload),
    }


def _redundant(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if payload is None:
        return None
    meta = payload["metadata"]
    return {
        "collected_at": _generated(payload),
        "redundant": meta.get("redundant", 0),
        "bot_prs_checked": meta.get("bot_prs_checked", 0),
        "records": records(_present(pd.DataFrame(payload["records"]), REDUNDANT_FIELDS)),
    }


def build_upgrades(ctx: BuildContext) -> dict[str, Any]:
    waves_config = ctx.config("waves").get("waves", {})
    return envelope(
        ctx,
        "collect-maintenance files",
        upgrade_jobs=_upgrade_jobs(ctx.maintenance.get(maintenance.UPGRADE_JOBS)),
        waves=[
            _wave(wave_id, wave, ctx.maintenance.get(maintenance.wave_file(wave_id)))
            for wave_id, wave in waves_config.items()
        ],
        redundant_prs=_redundant(ctx.maintenance.get(maintenance.REDUNDANT_PRS)),
    )


def load_maintenance_dir(directory: Path | None, waves_config: dict[str, Any]) -> dict[str, dict[str, Any] | None]:
    """Every maintenance file the views read, from a local directory; all None without one."""
    keys = maintenance_keys(waves_config)
    if directory is None:
        return dict.fromkeys(keys)
    return {key: maintenance.load_file(directory, key) for key in keys}

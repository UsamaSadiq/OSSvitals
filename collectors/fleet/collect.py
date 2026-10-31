"""Assemble a fork record: the core distance fields, each enabled signal's fields, then the status."""
from __future__ import annotations

import re
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from collectors.fleet.context import Api, ForkContext, MergedBy
from collectors.fleet.registry import BY_KEY
from collectors.fleet.settings import FleetSettings
from collectors.fleet.feeds import Feeds
from collectors.fleet.signals import RECORD_TIERS
from collectors.fleet.status import DriftSignals, classify


def _days_since(iso_date: str, now: datetime) -> int:
    return (now - datetime.fromisoformat(iso_date.replace("Z", "+00:00"))).days


def core(ctx: ForkContext) -> dict[str, Any]:
    comparison = ctx.comparison
    return {
        "repo": ctx.app["repo"],
        "production_branch": ctx.production,
        "ahead_by": comparison["ahead_by"],
        "behind_by": comparison["behind_by"],
        "last_upstream_merge": ctx.merged_at,
        "days_since_upstream_merge": _days_since(ctx.merged_at, ctx.now),
    }


def drift_signals(record: dict[str, Any]) -> DriftSignals:
    """Status reads only what enabled signals put in the record; a missing gap keeps the commits basis."""
    gap = record.get("release_gap")
    advisories = record.get("advisories")
    severe = (advisories["severe_affecting_fork_release"] if gap else advisories["severe_since_fork_release"]) if advisories else 0
    return DriftSignals(behind=record["behind_by"], days=record["days_since_upstream_merge"], severe_advisory=severe > 0, gap=gap)


def collect_fork(
    api: Api,
    org: str,
    app: dict[str, Any],
    settings: FleetSettings,
    now: datetime,
    merged_by: MergedBy = lambda *_: None,
    previous: dict[str, Any] | None = None,
    feeds: Feeds | None = None,
) -> dict[str, Any]:
    """``previous`` is this fork's record from the last published run; ``feeds`` are the outside feeds shared by the run."""
    ctx = ForkContext(api, org, app, settings, now, merged_by, previous, feeds)
    record = core(ctx)
    for key in settings.enabled_signals(*RECORD_TIERS):
        record.update(BY_KEY[key].collect(ctx))
    drift = drift_signals(record)
    return {**record, "status": classify(settings.statuses, drift), "status_basis": drift.basis}


CLONE_ERRORS = (RuntimeError, LookupError, KeyError, ValueError, OSError, re.error)


def _clone_record(key: str, ctx: ForkContext) -> dict[str, Any]:
    try:
        return {"repo": ctx.app["repo"], **BY_KEY[key].collect(ctx)}
    except CLONE_ERRORS as error:
        print(f"{ctx.app['repo']} {key}: {error}", file=sys.stderr)
        return {"repo": ctx.app["repo"], "error": str(error)}


def collect_clone_signals(
    keys: list[str],
    api: Api,
    org: str,
    app: dict[str, Any],
    settings: FleetSettings,
    now: datetime,
) -> dict[str, dict[str, Any]]:
    """Every weekly signal of one fork from one clone; a signal that fails records the error for this fork only."""
    with tempfile.TemporaryDirectory() as workspace:
        try:
            ctx = ForkContext(api, org, app, settings, now, workspace=Path(workspace))
        except CLONE_ERRORS as error:
            print(f"{app['repo']}: {error}", file=sys.stderr)
            return {key: {"repo": app["repo"], "error": str(error)} for key in keys}
        return {key: _clone_record(key, ctx) for key in keys}

from __future__ import annotations

from datetime import datetime
from typing import Any

from collectors.fleet.registry import SIGNALS
from collectors.fleet.settings import KIND, FleetSettings

SCHEMA_VERSION = 1
SOURCE = "github-api"
STATUS_FIELDS = ("key", "label", "color")


def signal_manifest(settings: FleetSettings) -> dict[str, Any]:
    """Every signal of the kind, so the site can list the ones a tenant turned off too."""
    return {
        signal.key: {
            "collect": settings.collects(signal.key),
            "show": settings.signal(signal.key)["show"] if settings.collects(signal.key) else [],
            "tier": signal.tier,
            "cadence": signal.cadence,
        }
        for signal in SIGNALS
    }


def meta_view(org: str, generated_at: datetime, *, branding: dict[str, Any], settings: FleetSettings, github_org: str) -> dict[str, Any]:
    freshness = settings.values["freshness"]
    return {
        "metadata": {
            "schema_version": SCHEMA_VERSION,
            "org": org,
            "generated_at": generated_at.isoformat(),
            "snapshot_timestamp": generated_at.isoformat(),
            "source": SOURCE,
        },
        "pages": settings.values["pages"],
        "branding": branding,
        "github_org": github_org,
        "feature_flags": settings.values["feature_flags"],
        "stale_threshold_hours": freshness["stale_threshold_hours"],
        "critically_stale_threshold_hours": freshness["critically_stale_threshold_hours"],
        "kind": KIND,
        "fleet": {
            "signals": signal_manifest(settings),
            "statuses": [{field: status[field] for field in STATUS_FIELDS if field in status} for status in settings.statuses],
        },
    }


def records_view(org: str, generated_at: datetime, records: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "metadata": {
            "schema_version": SCHEMA_VERSION,
            "org": org,
            "generated_at": generated_at.isoformat(),
            "snapshot_timestamp": generated_at.isoformat(),
            "source": SOURCE,
        },
        "records": records,
    }

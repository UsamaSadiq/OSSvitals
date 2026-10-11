from __future__ import annotations

from datetime import datetime
from typing import Any

SCHEMA_VERSION = 1
SOURCE = "github-api"
PAGES = ["/"]


def meta_view(org: str, generated_at: datetime, *, branding: dict[str, Any], rules: dict[str, Any], github_org: str) -> dict[str, Any]:
    freshness = rules["freshness"]
    return {
        "metadata": {
            "schema_version": SCHEMA_VERSION,
            "org": org,
            "generated_at": generated_at.isoformat(),
            "snapshot_timestamp": None,
            "source": SOURCE,
        },
        "pages": PAGES,
        "branding": branding,
        "github_org": github_org,
        "feature_flags": {"enable_maintainer_views": False},
        "stale_threshold_hours": freshness["stale_threshold_hours"],
        "critically_stale_threshold_hours": freshness["critically_stale_threshold_hours"],
    }


def records_view(org: str, generated_at: datetime, records: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "metadata": {
            "schema_version": SCHEMA_VERSION,
            "org": org,
            "generated_at": generated_at.isoformat(),
            "snapshot_timestamp": None,
            "source": SOURCE,
        },
        "records": records,
    }

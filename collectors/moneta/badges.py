from __future__ import annotations

from typing import Any

COLORS = {"in-sync": "brightgreen", "lagging": "yellow", "stale": "orange", "critical": "red"}


def badge(record: dict[str, Any]) -> dict[str, Any]:
    """Shields.io endpoint payload for a README badge."""
    return {
        "schemaVersion": 1,
        "label": "upstream sync",
        "message": f"{record['status']} ({record['behind_by']:,} behind)",
        "color": COLORS.get(record["status"], "lightgrey"),
    }

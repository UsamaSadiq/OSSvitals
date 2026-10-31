from __future__ import annotations

from typing import Any

UNKNOWN_COLOR = "lightgrey"


def badge(record: dict[str, Any], statuses: list[dict[str, Any]]) -> dict[str, Any]:
    """Shields.io endpoint payload for a README badge, coloured by the tenant's status ladder."""
    colors = {status["key"]: status.get("color", UNKNOWN_COLOR) for status in statuses}
    return {
        "schemaVersion": 1,
        "label": "upstream sync",
        "message": f"{record['status']} ({record['behind_by']:,} behind)",
        "color": colors.get(record["status"], UNKNOWN_COLOR),
    }

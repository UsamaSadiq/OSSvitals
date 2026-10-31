from __future__ import annotations

from typing import Any

from collectors.fleet.context import ForkContext
from collectors.fleet.signals import Signal


def collect(ctx: ForkContext) -> dict[str, Any]:
    return {"release_gap": ctx.release_gap}


SIGNAL = Signal("release_gap", collect, thresholds=("min_version_gap", "min_releases_behind", "min_days_behind_release"))

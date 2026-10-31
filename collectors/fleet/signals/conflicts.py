from __future__ import annotations

from typing import Any

from collectors.fleet import conflicts
from collectors.fleet.context import ForkContext
from collectors.fleet.signals import CLONE, Signal


def collect(ctx: ForkContext) -> dict[str, Any]:
    """Files a sync with upstream's head and latest release would conflict on (git merge-tree, no worktree)."""
    return conflicts.collect_forecast(ctx.clone, ctx.production, ctx.clone_release_tag)


SIGNAL = Signal("conflicts", collect, tier=CLONE, cadence="weekly")

from __future__ import annotations

from typing import Any

from collectors.fleet import patches
from collectors.fleet.conflicts import UPSTREAM_HEAD_REF
from collectors.fleet.context import ForkContext
from collectors.fleet.signals import CLONE, Signal


def collect(ctx: ForkContext) -> dict[str, Any]:
    """Our commits on the production branch, and which of them upstream already has (they drop at the next sync)."""
    max_blobs = ctx.settings.signal("carried_patches")["max_prefetch_blobs"]
    return patches.carried(ctx.clone, f"refs/heads/{ctx.production}", UPSTREAM_HEAD_REF, ctx.fork_url, ctx.upstream_url, max_blobs)


SIGNAL = Signal("carried_patches", collect, tier=CLONE, cadence="weekly")

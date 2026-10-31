from __future__ import annotations

from typing import Any

from collectors.fleet import fork
from collectors.fleet.context import ForkContext
from collectors.fleet.signals import Signal, guarded


def collect(ctx: ForkContext) -> dict[str, Any]:
    distance = guarded(lambda: fork.release_distance(ctx.api, ctx.base, ctx.owner, ctx.production, ctx.upstream_release)) or {}
    return {
        "upstream_release": ctx.upstream_release,
        "behind_release": distance.get("behind_release"),
        "ahead_release": distance.get("ahead_release"),
        "release_lag": fork.release_lag(ctx.upstream_releases, ctx.merged_at, ctx.fork_release),
    }


SIGNAL = Signal("upstream_release", collect)

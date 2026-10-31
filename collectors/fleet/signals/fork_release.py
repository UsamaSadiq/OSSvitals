from __future__ import annotations

from typing import Any

from collectors.fleet import fork
from collectors.fleet.context import ForkContext
from collectors.fleet.signals import Signal


def collect(ctx: ForkContext) -> dict[str, Any]:
    candidate = fork.pending_release_candidate(ctx.api, ctx.base, ctx.upstream_ref, ctx.tags, ctx.fork_release, ctx.fork_pattern)
    return {"fork_release": ctx.fork_release, "release_candidate": candidate}


SIGNAL = Signal("fork_release", collect)

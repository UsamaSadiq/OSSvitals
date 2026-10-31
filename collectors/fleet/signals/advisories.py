from __future__ import annotations

from typing import Any

from collectors.fleet import fork
from collectors.fleet.context import ForkContext
from collectors.fleet.signals import Signal


def collect(ctx: ForkContext) -> dict[str, Any]:
    since = ctx.fork_release["date"] if ctx.fork_release else None
    severe = ctx.settings.signal("advisories")["severe"]
    return {"advisories": fork.advisory_summary(ctx.api, ctx.upstream, since, severe, ctx.base_release, ctx.upstream_advisories, ctx.code_since)}


SIGNAL = Signal("advisories", collect, thresholds=("on_severe_advisory",))

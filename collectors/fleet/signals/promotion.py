from __future__ import annotations

from typing import Any

from collectors.fleet import fork
from collectors.fleet.context import ForkContext
from collectors.fleet.signals import Signal


def collect(ctx: ForkContext) -> dict[str, Any]:
    """Commits on staging not yet on production; ``None`` for an app that releases from its own branch."""
    return {"promotion": fork.promotion(ctx.api, ctx.base, ctx.production, ctx.staging)}


SIGNAL = Signal("promotion", collect, requires=("branches.staging",))

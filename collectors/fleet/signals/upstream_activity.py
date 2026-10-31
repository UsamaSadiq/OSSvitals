from __future__ import annotations

from datetime import datetime
from typing import Any

from collectors.fleet.context import ForkContext
from collectors.fleet.signals import Signal, guarded


def upstream_activity(repo: dict[str, Any] | None, now: datetime, quiet_days: int) -> dict[str, Any] | None:
    if repo is None:
        return None
    pushed_at = repo["pushed_at"]
    idle_days = (now - datetime.fromisoformat(pushed_at.replace("Z", "+00:00"))).days
    return {"pushed_at": pushed_at, "idle_days": idle_days, "quiet": idle_days > quiet_days}


def collect(ctx: ForkContext) -> dict[str, Any]:
    quiet_days = ctx.settings.signal("upstream_activity")["quiet_days"]
    return {"upstream_activity": guarded(lambda: upstream_activity(ctx.upstream_repo, ctx.now, quiet_days))}


SIGNAL = Signal("upstream_activity", collect)

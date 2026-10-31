from __future__ import annotations

from typing import Any, Callable

from collectors.fleet.context import ForkContext
from collectors.fleet.signals import Signal, guarded

FAILING_CONCLUSIONS = {"failure", "timed_out", "cancelled", "action_required", "startup_failure"}


def ci_status(api: Callable[[str], Any], base: str, production: str) -> dict[str, Any] | None:
    data = api(f"{base}/commits/{production}/check-runs?per_page=100")
    if data is None:
        return None
    conclusions = [run.get("conclusion") for run in data.get("check_runs", [])]
    if not conclusions:
        return {"state": "none", "total": 0}
    if any(conclusion in FAILING_CONCLUSIONS for conclusion in conclusions):
        state = "failing"
    elif any(conclusion is None for conclusion in conclusions):
        state = "pending"
    else:
        state = "passing"
    return {"state": state, "total": len(conclusions)}


def collect(ctx: ForkContext) -> dict[str, Any]:
    return {"ci": guarded(lambda: ci_status(ctx.api, ctx.base, ctx.production))}


SIGNAL = Signal("ci", collect)

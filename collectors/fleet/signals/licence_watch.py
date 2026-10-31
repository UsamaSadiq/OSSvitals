"""Whether upstream's licence file changed since the last run, and whether it still matches the licence we list.

GitHub cannot name many licences that matter here (BUSL, mixed licences report NOASSERTION), so the file's
content hash is what is watched; the SPDX id only feeds the declared-versus-detected check.
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any, Callable
from urllib.parse import quote

from collectors.fleet.context import ForkContext
from collectors.fleet.signals import Signal, guarded

UNRECOGNISED = {"NOASSERTION", "OTHER"}
VARIANT = re.compile(r"-(only|or-later)$")


def licence_file(api: Callable[[str], Any], upstream: str, branch: str) -> dict[str, Any]:
    """A 404 means upstream has no licence file on that branch, which is itself worth showing."""
    data = api(f"repos/{upstream}/license?ref={quote(branch, safe='')}")
    if data is None:
        return {"present": False, "path": None, "sha": None, "spdx": None}
    spdx = (data.get("license") or {}).get("spdx_id")
    return {"present": True, "path": data["path"], "sha": data["sha"], "spdx": None if spdx in UNRECOGNISED else spdx}


def _family(spdx: str | None) -> str | None:
    return VARIANT.sub("", spdx) if spdx else None


def matches_declared(declared: str | None, spdx: str | None) -> bool | None:
    """Unknown on either side is not a mismatch; GPL-3.0 and GPL-3.0-or-later count as the same licence."""
    if not declared or not spdx:
        return None
    return _family(declared) == _family(spdx)


def _still_recent(changed_on: str | None, today: date, notice_days: int) -> bool:
    return bool(changed_on) and (today - date.fromisoformat(changed_on)).days < notice_days


def watch(current: dict[str, Any], previous: dict[str, Any] | None, declared: str | None, today: date, notice_days: int) -> dict[str, Any]:
    """The first run is a baseline; a new hash marks today; a change stays marked for `notice_days`."""
    record = {**current, "declared": declared, "matches_declared": matches_declared(declared, current["spdx"])}
    if not previous:
        return {**record, "changed_on": None, "previous_spdx": None, "previous_present": None}
    if previous.get("sha") != current["sha"]:
        return {**record, "changed_on": today.isoformat(), "previous_spdx": previous.get("spdx"), "previous_present": previous.get("present")}
    if _still_recent(previous.get("changed_on"), today, notice_days):
        return {**record, "changed_on": previous["changed_on"], "previous_spdx": previous.get("previous_spdx"), "previous_present": previous.get("previous_present")}
    return {**record, "changed_on": None, "previous_spdx": None, "previous_present": None}


def collect(ctx: ForkContext) -> dict[str, Any]:
    notice_days = ctx.settings.signal("licence_watch")["notice_days"]
    previous = (ctx.previous or {}).get("licence_watch")

    def observe() -> dict[str, Any]:
        current = licence_file(ctx.api, ctx.upstream, ctx.app["upstream_branch"])
        return watch(current, previous, ctx.app.get("licence"), ctx.now.date(), notice_days)

    return {"licence_watch": guarded(observe)}


SIGNAL = Signal("licence_watch", collect)

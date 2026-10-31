from __future__ import annotations

from typing import Any

from collectors.fleet import upgrade
from collectors.fleet.conflicts import UPSTREAM_HEAD_REF
from collectors.fleet.context import ForkContext
from collectors.fleet.patches import _git
from collectors.fleet.signals import CLONE, Signal


def collect(ctx: ForkContext) -> dict[str, Any]:
    """Migrations we carry against those upstream added since our last sync (from the shared clone), and release notes
    above the upstream release our production branch is built on."""
    dir_names = ctx.settings.signal("upgrade_risk")["migration_dirs"]
    ours = f"refs/heads/{ctx.production}"
    merge_base = _git(ctx.clone, "merge-base", UPSTREAM_HEAD_REF, ours).strip()
    carried = upgrade.net_added(ctx.clone, merge_base, ours)
    added_upstream = upgrade.net_added(ctx.clone, merge_base, UPSTREAM_HEAD_REF)
    return {
        "migrations": upgrade.migrations(carried, added_upstream, dir_names),
        "release_notes": upgrade.release_notes(ctx.upstream_releases, ctx.production_base_release, ctx.merged_at),
    }


SIGNAL = Signal("upgrade_risk", collect, tier=CLONE, cadence="weekly")

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

from collectors.fleet import conflicts, fork
from collectors.fleet.context import ForkContext
from collectors.fleet.signals import CLONE, Signal


def _latest_release_tag(ctx: ForkContext) -> str | None:
    releases = fork.upstream_releases(ctx.api, ctx.upstream)
    release = fork.latest_upstream_release(ctx.api, ctx.upstream, releases)
    return release["tag"] if release else None


def collect(ctx: ForkContext) -> dict[str, Any]:
    """Files a sync with upstream's head and latest release would conflict on (git merge-tree, no worktree)."""
    tag = _latest_release_tag(ctx)
    with tempfile.TemporaryDirectory() as tmp:
        directory = Path(tmp) / "clone.git"
        conflicts.prepare_clone(
            directory,
            f"https://github.com/{ctx.org}/{ctx.app['repo']}.git",
            ctx.production,
            f"https://github.com/{ctx.upstream}.git",
            ctx.app["upstream_branch"],
            tag,
        )
        return conflicts.collect_forecast(directory, ctx.production, tag)


SIGNAL = Signal("conflicts", collect, tier=CLONE, cadence="weekly")

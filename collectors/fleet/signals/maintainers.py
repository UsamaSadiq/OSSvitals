from __future__ import annotations

from collections import Counter
from typing import Any, Callable

from collectors.fleet.context import ForkContext
from collectors.fleet.signals import Signal, guarded


def merged_by(lookup: Callable[[str, str, str], list[str] | None], owner: str, name: str, production: str) -> list[dict[str, Any]] | None:
    """People who merged pull requests in our fork, most active first. Upstream maintainers do not appear."""
    logins = lookup(owner, name, production)
    if logins is None:
        return None
    counts = Counter(logins)
    return [{"login": login, "merged": merged} for login, merged in sorted(counts.items(), key=lambda item: (-item[1], item[0].lower()))]


def collect(ctx: ForkContext) -> dict[str, Any]:
    return {"maintainers": guarded(lambda: merged_by(ctx.merged_by, ctx.org, ctx.app["repo"], ctx.production))}


SIGNAL = Signal("maintainers", collect)

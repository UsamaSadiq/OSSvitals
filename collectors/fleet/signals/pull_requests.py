from __future__ import annotations

import re
from typing import Any, Callable

from collectors.fleet.context import ForkContext
from collectors.fleet.signals import Signal, guarded

SYNC_WORDS = re.compile(r"upstream|sync", re.IGNORECASE)


def open_pull_requests(api: Callable[[str], Any], base: str, production: str) -> dict[str, Any] | None:
    pulls = api(f"{base}/pulls?base={production}&state=open&per_page=100")
    if pulls is None:
        return None
    sync = next((pull for pull in pulls if SYNC_WORDS.search(pull["title"]) or SYNC_WORDS.search(pull["head"]["ref"])), None)
    sync_pull = {"number": sync["number"], "title": sync["title"], "url": sync["html_url"]} if sync else None
    return {"open": len(pulls), "sync_pull": sync_pull}


def collect(ctx: ForkContext) -> dict[str, Any]:
    return {"pull_requests": guarded(lambda: open_pull_requests(ctx.api, ctx.base, ctx.production))}


SIGNAL = Signal("pull_requests", collect)

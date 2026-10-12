from __future__ import annotations

import re
from collections import Counter
from datetime import datetime
from typing import Any, Callable, TypeVar

T = TypeVar("T")

FAILING_CONCLUSIONS = {"failure", "timed_out", "cancelled", "action_required", "startup_failure"}
SYNC_WORDS = re.compile(r"upstream|sync", re.IGNORECASE)


def guarded(collect: Callable[[], T]) -> T | None:
    """An optional signal that fails must not take the whole fork record down with it."""
    try:
        return collect()
    except (RuntimeError, KeyError, ValueError, TypeError):
        return None


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


def open_pull_requests(api: Callable[[str], Any], base: str, production: str) -> dict[str, Any] | None:
    pulls = api(f"{base}/pulls?base={production}&state=open&per_page=100")
    if pulls is None:
        return None
    sync = next((pull for pull in pulls if SYNC_WORDS.search(pull["title"]) or SYNC_WORDS.search(pull["head"]["ref"])), None)
    sync_pull = {"number": sync["number"], "title": sync["title"], "url": sync["html_url"]} if sync else None
    return {"open": len(pulls), "sync_pull": sync_pull}


def merged_by(lookup: Callable[[str, str, str], list[str] | None], owner: str, name: str, production: str) -> list[dict[str, Any]] | None:
    """People who merged pull requests in our fork, most active first. Upstream maintainers do not appear."""
    logins = lookup(owner, name, production)
    if logins is None:
        return None
    counts = Counter(logins)
    return [{"login": login, "merged": merged} for login, merged in sorted(counts.items(), key=lambda item: (-item[1], item[0].lower()))]


def upstream_activity(api: Callable[[str], Any], upstream: str, now: datetime, quiet_days: int) -> dict[str, Any] | None:
    repo = api(f"repos/{upstream}")
    if repo is None:
        return None
    pushed_at = repo["pushed_at"]
    idle_days = (now - datetime.fromisoformat(pushed_at.replace("Z", "+00:00"))).days
    return {"pushed_at": pushed_at, "idle_days": idle_days, "quiet": idle_days > quiet_days}

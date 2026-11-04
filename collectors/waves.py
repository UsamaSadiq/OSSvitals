"""Pilot B: per-repo progress on platform-wide upgrade waves (``waves.yaml``)."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from dashboard.lib.upgrades import content_rules, rule_label

DONE = "done"
PR_OPEN = "pr_open"
NOT_STARTED = "not_started"
NOT_APPLICABLE = "not_applicable"
STATUS_ORDER = (NOT_STARTED, PR_OPEN, DONE, NOT_APPLICABLE)


def _bare_name(full_name: str) -> str:
    return full_name.rsplit("/", 1)[-1]


def applies(full_name: str, paths: set[str], wave: dict[str, Any]) -> bool:
    scope = wave.get("applies_to") or {}
    name_regex = scope.get("name_regex")
    if name_regex and not re.search(name_regex, _bare_name(full_name)):
        return False
    wanted = scope.get("has_any") or []
    return not wanted or bool(paths & set(wanted))


def content_paths(wave: dict[str, Any]) -> list[str]:
    return sorted({rule["path"] for rule in content_rules(wave)})


def _unmet_content(contents: dict[str, str | None], wave: dict[str, Any]) -> list[str]:
    return [
        rule_label(rule)
        for rule in content_rules(wave)
        if not re.search(rule["pattern"], contents.get(rule["path"]) or "")
    ]


def done_gaps(
    full_name: str, paths: set[str], wave: dict[str, Any], contents: dict[str, str | None] | None = None
) -> tuple[list[str], list[str]]:
    done = wave.get("done") or {}
    allowed = set((wave.get("allowed_leftovers") or {}).get(full_name, []))
    missing = [path for path in done.get("present", []) if path not in paths] + _unmet_content(contents or {}, wave)
    leftover = [path for path in done.get("absent", []) if path in paths and path not in allowed]
    return missing, leftover


def matching_prs(prs: list[dict[str, Any]], wave: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Oldest open matching PR per repo, keyed by ``owner/name``."""
    pattern = re.compile(wave["pull_requests"]["title_regex"], re.IGNORECASE)
    oldest: dict[str, dict[str, Any]] = {}
    for pr in prs:
        if not pattern.search(pr.get("title", "")):
            continue
        repo = pr["repository"]["nameWithOwner"]
        if repo not in oldest or pr["createdAt"] < oldest[repo]["createdAt"]:
            oldest[repo] = pr
    return oldest


def repo_status(
    full_name: str,
    paths: set[str],
    wave: dict[str, Any],
    open_pr: dict[str, Any] | None,
    *,
    now: datetime,
    contents: dict[str, str | None] | None = None,
) -> dict[str, Any]:
    missing, leftover = done_gaps(full_name, paths, wave, contents)
    if not applies(full_name, paths, wave):
        status = NOT_APPLICABLE
    elif not missing and not leftover:
        status = DONE
    elif open_pr:
        status = PR_OPEN
    else:
        status = NOT_STARTED
    created = datetime.fromisoformat(open_pr["createdAt"].replace("Z", "+00:00")) if open_pr else None
    return {
        "repo_name": full_name,
        "status": status,
        "missing": missing if status != NOT_APPLICABLE else [],
        "leftover": leftover if status != NOT_APPLICABLE else [],
        "pr_url": open_pr["url"] if open_pr and status == PR_OPEN else None,
        "pr_title": open_pr["title"] if open_pr and status == PR_OPEN else None,
        "pr_age_days": (now - created).days if created and status == PR_OPEN else None,
    }


def summary(records: list[dict[str, Any]]) -> dict[str, int]:
    counts = {status: 0 for status in STATUS_ORDER}
    for record in records:
        counts[record["status"]] += 1
    applicable = len(records) - counts[NOT_APPLICABLE]
    counts["applicable"] = applicable
    counts["percent_done"] = round(counts[DONE] / applicable * 100) if applicable else 0
    return counts


def ordered(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        records,
        key=lambda record: (STATUS_ORDER.index(record["status"]), -(record["pr_age_days"] or 0), record["repo_name"]),
    )

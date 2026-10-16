"""Open remediation PRs, as published by the fix_prs collector, grouped for the views."""
from __future__ import annotations

from typing import Any

FIELDS = ("pr_number", "pr_url", "pr_title", "author", "is_draft", "created_at", "open_count")


def by_repo_and_check(entries: list[dict[str, Any]]) -> dict[str, dict[str, dict[str, Any]]]:
    """Newest open PR per (repo, check), with how many are open for that pair."""
    grouped: dict[str, dict[str, dict[str, Any]]] = {}
    for entry in entries:
        checks = grouped.setdefault(entry["repo_name"], {})
        current = checks.get(entry["check"])
        if current is None:
            checks[entry["check"]] = {**entry, "open_count": 1}
        else:
            current["open_count"] += 1
            if entry["pr_number"] > current["pr_number"]:
                checks[entry["check"]] = {**entry, "open_count": current["open_count"]}
    return grouped


def view_entry(entry: dict[str, Any]) -> dict[str, Any]:
    return {field: entry.get(field) for field in FIELDS}

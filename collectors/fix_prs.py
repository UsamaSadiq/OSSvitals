"""Open pull requests that carry the OSSvitals marker lines a remediation tool writes.

A remediation PR ends its body with two lines::

    OSSvitals-Check: exists..editorconfig
    OSSvitals-Repo: openedx/django-config-models

GitHub search only yields candidates; the body is the truth. A record is kept only
when both lines parse and the PR's base repository is the repository the marker
names, so a draft opened on a fork is never shown as fixing upstream.
"""
from __future__ import annotations

import re
from typing import Any

SOURCE = "GitHub search for open pull requests carrying OSSvitals-Check and OSSvitals-Repo marker lines"
MARKER_SEARCH = '"OSSvitals-Check:" in:body is:pr is:open'

_CHECK_LINE = re.compile(r"^OSSvitals-Check:[ \t]*(\S+)[ \t]*$", re.MULTILINE)
_REPO_LINE = re.compile(r"^OSSvitals-Repo:[ \t]*(\S+)[ \t]*$", re.MULTILINE)


def markers(body: str | None) -> tuple[str, str] | None:
    """(check, repo) from the marker lines, or None when either is missing."""
    text = (body or "").replace("\r", "")
    check, repo = _CHECK_LINE.search(text), _REPO_LINE.search(text)
    if check is None or repo is None:
        return None
    return check.group(1), repo.group(1)


def record(pr: dict[str, Any]) -> dict[str, Any] | None:
    """A publishable record for a search hit, or None when it does not qualify."""
    found = markers(pr.get("body"))
    if found is None:
        return None
    check, repo = found
    base = (pr.get("baseRepository") or {}).get("nameWithOwner")
    if base is None or base.lower() != repo.lower():
        return None
    head = (pr.get("headRepository") or {}).get("nameWithOwner")
    return {
        "repo_name": base,
        "check": check,
        "pr_number": pr["number"],
        "pr_url": pr["url"],
        "pr_title": pr.get("title", ""),
        "author": (pr.get("author") or {}).get("login"),
        "is_draft": bool(pr.get("isDraft")),
        "head_repo": head,
        "created_at": pr.get("createdAt"),
        "updated_at": pr.get("updatedAt"),
    }


def records(hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    kept = [entry for entry in (record(pr) for pr in hits) if entry is not None]
    return sorted(kept, key=lambda item: (item["repo_name"], item["check"], -item["pr_number"]))


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

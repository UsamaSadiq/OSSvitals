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


def _last(pattern: re.Pattern[str], text: str) -> str | None:
    found = pattern.findall(text)
    return found[-1] if found else None


def markers(body: str | None) -> tuple[str, str] | None:
    """(check, repo) from the last marker lines in the body, or None when either is missing.

    The marker is the trailing pair; an earlier pair (a quoted template, a cited PR) must not win.
    """
    text = (body or "").replace("\r", "")
    check, repo = _last(_CHECK_LINE, text), _last(_REPO_LINE, text)
    if check is None or repo is None:
        return None
    return check, repo


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

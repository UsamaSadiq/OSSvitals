"""Grouping of published remediation PRs for the repo detail view."""
from __future__ import annotations

from dashboard.lib import fix_prs


def _entry(number: int, check: str = "exists..editorconfig", repo: str = "openedx/alpha") -> dict:
    return {
        "repo_name": repo, "check": check, "pr_number": number, "pr_url": f"https://github.com/{repo}/pull/{number}",
        "pr_title": "chore: fix", "author": "someone", "is_draft": number % 2 == 0, "head_repo": None,
        "created_at": None, "updated_at": None,
    }


def test_keeps_the_newest_per_check_and_counts_the_rest_whatever_the_order():
    grouped = fix_prs.by_repo_and_check([_entry(3), _entry(9), _entry(5), _entry(2, check="a.b"), _entry(4, repo="openedx/beta")])

    alpha = grouped["openedx/alpha"]
    assert (alpha["exists..editorconfig"]["pr_number"], alpha["exists..editorconfig"]["open_count"]) == (9, 3)
    assert (alpha["a.b"]["pr_number"], alpha["a.b"]["open_count"]) == (2, 1)
    assert grouped["openedx/beta"]["exists..editorconfig"]["open_count"] == 1


def test_view_entry_keeps_only_the_published_fields():
    entry = fix_prs.view_entry({**_entry(9), "open_count": 2})

    assert set(entry) == set(fix_prs.FIELDS)
    assert (entry["pr_number"], entry["open_count"], entry["author"]) == (9, 2, "someone")

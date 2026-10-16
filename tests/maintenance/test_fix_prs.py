"""Open remediation PRs: marker parsing, qualification and newest-per-check grouping."""
from __future__ import annotations

from collectors import fix_prs

BODY = (
    "## Description\n\n- Adds the file.\n\n"
    "OSSvitals-Check: exists..editorconfig\r\nOSSvitals-Repo: openedx/django-config-models\n"
)


def _hit(**overrides):
    base = {
        "number": 481,
        "url": "https://github.com/openedx/django-config-models/pull/481",
        "title": "chore: add the edx-lint editorconfig",
        "body": BODY,
        "state": "OPEN",
        "isDraft": True,
        "createdAt": "2026-10-16T13:00:00Z",
        "updatedAt": "2026-10-16T13:05:00Z",
        "author": {"login": "usamasadiq"},
        "baseRepository": {"nameWithOwner": "openedx/django-config-models"},
        "headRepository": {"nameWithOwner": "UsamaSadiq/django-config-models"},
    }
    return {**base, **overrides}


def test_markers_read_both_lines_and_ignore_carriage_returns():
    assert fix_prs.markers(BODY) == ("exists..editorconfig", "openedx/django-config-models")


def test_markers_take_the_trailing_pair_over_a_quoted_template():
    body = "Template:\n```\nOSSvitals-Check: <check>\nOSSvitals-Repo: <org/repo>\n```\n\n" + BODY
    assert fix_prs.markers(body) == ("exists..editorconfig", "openedx/django-config-models")


def test_markers_need_both_lines_at_line_start():
    assert fix_prs.markers("OSSvitals-Check: a.b\n") is None
    assert fix_prs.markers("see OSSvitals-Check: a.b\nOSSvitals-Repo: o/r\n") is None
    assert fix_prs.markers(None) is None


def test_record_keeps_a_pr_whose_base_is_the_marker_repo():
    entry = fix_prs.record(_hit())

    assert entry == {
        "repo_name": "openedx/django-config-models",
        "check": "exists..editorconfig",
        "pr_number": 481,
        "pr_url": "https://github.com/openedx/django-config-models/pull/481",
        "pr_title": "chore: add the edx-lint editorconfig",
        "author": "usamasadiq",
        "is_draft": True,
        "head_repo": "UsamaSadiq/django-config-models",
        "created_at": "2026-10-16T13:00:00Z",
        "updated_at": "2026-10-16T13:05:00Z",
    }


def test_record_drops_a_fork_pr_a_body_without_markers_and_a_merged_pr():
    on_fork = _hit(baseRepository={"nameWithOwner": "UsamaSadiq/django-config-models"})
    assert fix_prs.record(on_fork) is None
    assert fix_prs.record(_hit(body="no markers here")) is None
    assert fix_prs.record(_hit(state="MERGED")) is None


def test_records_sort_by_repo_check_and_newest_first():
    hits = [_hit(number=3), _hit(number=9), _hit(number=5, body=BODY.replace("exists..editorconfig", "a.b"))]

    ordered = [(entry["check"], entry["pr_number"]) for entry in fix_prs.records(hits)]

    assert ordered == [("a.b", 5), ("exists..editorconfig", 9), ("exists..editorconfig", 3)]

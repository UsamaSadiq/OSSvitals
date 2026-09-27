"""Staleness rules for the data-freshness workflow."""
from __future__ import annotations

from datetime import date

from dashboard.lib import freshness

TODAY = date(2026, 9, 27)


def test_dates_parse_from_iso_timestamps_and_plain_dates():
    assert freshness.to_date("2026-09-27T08:23:11.5+00:00") == date(2026, 9, 27)
    assert freshness.to_date("2026-09-25") == date(2026, 9, 25)
    assert freshness.to_date("") is None
    assert freshness.to_date("not a date") is None


def test_age_within_limit_is_ok_and_beyond_is_stale():
    assert not freshness.status("a", "u", date(2026, 9, 25), today=TODAY, max_age_days=2).stale
    assert freshness.status("a", "u", date(2026, 9, 24), today=TODAY, max_age_days=2).stale


def test_unreadable_source_is_stale():
    item = freshness.status("a", "u", None, today=TODAY, max_age_days=2, detail="HTTPError")

    assert item.stale
    assert item.detail == "HTTPError"


def test_report_lists_every_source_with_its_state():
    text = freshness.report(
        [
            freshness.status("CSV", "https://x/csv", date(2026, 9, 27), today=TODAY, max_age_days=2),
            freshness.status("Scores", "https://x/s", None, today=TODAY, max_age_days=2, detail="HTTPError"),
        ],
        max_age_days=2,
    )

    assert "| [CSV](https://x/csv) | 2026-09-27 | 0 | ok |" in text
    assert "| [Scores](https://x/s) | unreadable |  | stale (HTTPError) |" in text

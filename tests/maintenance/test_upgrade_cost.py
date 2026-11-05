"""Upgrade cost per named release: DEPR tickets, breaking changes and release cadence."""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone

import pytest

from collectors import github, upgrade_cost
from dashboard.lib.config import get_config
from scripts import collect_maintenance
from scripts.collect_maintenance import ReleaseTag

NAMES = ["nutmeg", "olive", "palm", "quince", "redwood", "sumac", "teak", "ulmo", "verawood", "willow"]

NOTES = """
Breaking Changes
****************

-  Deployers must update ``JWT_PRIVATE_SIGNING_JWK``.

   -  Background: nested bullet, not a change of its own.

* The ``VERIFY_STUDENT["STORAGE_CLASS"]`` setting is deprecated.

  **Breaking change**: the default storage changed.

Deprecations & Removals
***********************

* Not a breaking change.
"""


@pytest.fixture(scope="module")
def config() -> dict:
    return get_config("upgrade_cost", "openedx")


def body(value: str, heading: str = "Earliest Open edX Named Release Without This Functionality") -> str:
    return f"### Rationale\n\nOld.\n\n### {heading}\n\n{value}\n\n### Additional Info\n\nNone\n"


@pytest.mark.parametrize(
    ("value", "release"),
    [
        ("Ulmo - 2025-10", "ulmo"),
        ("nutmeg", "nutmeg"),
        ("Sumac release, October 2024", "sumac"),
        ("Palm - 2023-04 (Q+ more likely)", "palm"),
        ("Q - 2023-10", "quince"),
        ("TBD", None),
        ("This will not be tagged for Redwood, even if no other changes happen.", None),
        ("N/A: This is not part of a release", None),
    ],
)
def test_release_named_reads_the_leading_name_or_initial(value, release):
    assert upgrade_cost.release_named(value, NAMES) == release


def test_an_ambiguous_initial_names_no_release():
    assert upgrade_cost.release_named("s - 2024", ["sumac", "spruce"]) is None


def test_field_value_skips_blank_lines_and_stops_at_the_next_field(config):
    field = config["deprecations"]["release_field"]
    assert upgrade_cost.field_value(body("Teak - 2025-04"), field) == "Teak - 2025-04"
    assert upgrade_cost.field_value(body("Ulmo", "First Open edX Named Release Without This Functionality"), field) == "Ulmo"
    assert upgrade_cost.field_value(body("Ulmo", "Earliest Open edX Named Release with Breaking Changes"), field) == "Ulmo"
    assert upgrade_cost.field_value("### Earliest Open edX Named Release Without This Functionality\n\n### Next\n", field) is None
    assert upgrade_cost.field_value(None, field) is None


def test_section_items_counts_top_level_bullets_in_the_section_only():
    assert upgrade_cost.section_items(NOTES, "Breaking Changes") == 2
    assert upgrade_cost.section_items(NOTES, "Deprecations & Removals") == 1
    assert upgrade_cost.section_items(NOTES, "Known Issues") is None
    assert upgrade_cost.section_items(None, "Breaking Changes") is None


def test_release_rows_carry_cadence_and_counts():
    tickets = [{"state": "open", "body": body("Ulmo")}, {"state": "closed", "body": body("ulmo - 2025-10")}, {"state": "open", "body": body("TBD")}]
    grouped = upgrade_cost.by_release(tickets, NAMES, r"Named Release")
    releases = [("teak", date(2025, 6, 23)), ("ulmo", date(2026, 1, 15)), ("willow", None)]

    rows = upgrade_cost.release_rows(releases, grouped, {"teak": 3, "ulmo": 2})

    assert [(row["release"], row["date"], row["days_since_previous"], row["breaking_changes"]) for row in rows] == [
        ("teak", "2025-06-23", None, 3),
        ("ulmo", "2026-01-15", 206, 2),
        ("willow", None, None, None),
    ]
    assert rows[1]["deprecations"] == {"total": 2, "open": 1, "closed": 1}
    assert upgrade_cost.deprecation_counts(grouped[None]) == {"total": 1, "open": 1, "closed": 0}


def test_summary_counts_cut_releases_and_every_open_ticket():
    rows = [
        {"date": "2025-06-23", "days_since_previous": None, "deprecations": {"total": 4, "open": 0, "closed": 4}},
        {"date": "2026-01-15", "days_since_previous": 206, "deprecations": {"total": 13, "open": 4, "closed": 9}},
        {"date": "2026-07-29", "days_since_previous": 195, "deprecations": {"total": 7, "open": 4, "closed": 3}},
        {"date": None, "days_since_previous": None, "deprecations": {"total": 1, "open": 1, "closed": 0}},
    ]
    unscheduled = {"total": 60, "open": 7, "closed": 53}

    assert upgrade_cost.summary(rows, unscheduled) == {
        "releases": 3,
        "median_days_between": 206,
        "deprecations": 25,
        "open_deprecations": 16,
        "unscheduled": unscheduled,
    }


def test_configured_patterns_compile(config):
    re.compile(config["deprecations"]["release_field"])


@pytest.fixture
def fake(monkeypatch, config):
    releases = {
        "maple": ReleaseTag("open-release/maple.1", datetime(2021, 12, 16, tzinfo=timezone.utc)),
        "nutmeg": ReleaseTag("open-release/nutmeg.1", datetime(2022, 6, 8, tzinfo=timezone.utc)),
        "olive": ReleaseTag("open-release/olive.1", datetime(2022, 12, 8, tzinfo=timezone.utc)),
    }
    tickets = [
        {"state": "closed", "body": body("Maple")},
        {"state": "closed", "body": body("Nutmeg")},
        {"state": "open", "body": body("Willow - 2026-12")},
        {"state": "open", "body": body("TBD")},
    ]
    notes = {"source/community/release_notes/olive/dev_op_release_notes.rst": NOTES}
    monkeypatch.setattr(collect_maintenance, "release_tags", lambda repo, prefixes: releases)
    monkeypatch.setattr(github, "labelled_issues", lambda repo, label: tickets)
    monkeypatch.setattr(github, "raw_text", lambda repo, ref, path: notes.get(path))
    monkeypatch.setattr(collect_maintenance, "now_utc", lambda: datetime(2026, 11, 5, tzinfo=timezone.utc))
    return releases


def _collect(tmp_path) -> int:
    return collect_maintenance.collect_upgrade_cost(tmp_path, scope=None, target=collect_maintenance.Target("openedx", "openedx"))


def test_collector_writes_rows_from_first_and_buckets_the_rest(tmp_path, fake):
    assert _collect(tmp_path) == 0

    published = json.loads((tmp_path / collect_maintenance.UPGRADE_COST_FILE).read_text(encoding="utf-8"))
    rows = {row["release"]: row for row in published["records"]}
    assert list(rows) == ["nutmeg", "olive", "willow", "xylon"]
    assert rows["olive"]["days_since_previous"] == 183
    assert rows["olive"]["breaking_changes"] == 2
    assert rows["olive"]["notes_url"].endswith("/release_notes/olive/dev_op_release_notes.rst")
    assert rows["nutmeg"]["notes_url"] is None
    assert rows["willow"]["deprecations"] == {"total": 1, "open": 1, "closed": 0} and rows["willow"]["date"] is None
    meta = published["metadata"]
    assert meta["earlier"] == {"total": 1, "open": 0, "closed": 1}
    assert meta["unscheduled"] == {"total": 1, "open": 1, "closed": 0}


def test_collector_keeps_the_file_when_the_first_release_is_missing(tmp_path, fake, monkeypatch, capsys):
    monkeypatch.setattr(collect_maintenance, "release_tags", lambda repo, prefixes: {"olive": fake["olive"]})

    assert _collect(tmp_path) == 0
    assert "first release 'nutmeg' has no readable .1 tag" in capsys.readouterr().out
    assert not (tmp_path / collect_maintenance.UPGRADE_COST_FILE).exists()

from __future__ import annotations

from datetime import date

import pytest

from collectors import support_windows as sw

TODAY = date(2026, 10, 31)
BARCALENDAR = '''
versions = get_defaults_from_tutor()
CURRENT = {
    "Open edX": parse_version_name(versions['OPENEDX_COMMON_VERSION']),
    "Python": "3.11",
    "Redis": parse_version_number(versions['DOCKER_IMAGE_REDIS']),
}
'''
TUTOR = sw.Detected("3.12", "overhangio/tutor", "v22.0.3", "tutor/templates/build/openedx/Dockerfile")


def row(cycle: str, released: str, eol: str | bool = False, lts: bool | str = False) -> dict:
    return {"cycle": cycle, "releaseDate": released, "eol": eol, "lts": lts}


def test_declared_versions_separate_literals_from_tutor_lookups():
    declared = sw.declared_versions(BARCALENDAR)

    assert declared["Python"] == sw.Declared(sw.DECLARED, "3.11")
    assert declared["Open edX"].kind == sw.FOLLOWS_TUTOR
    assert declared["Redis"].kind == sw.FOLLOWS_TUTOR


def test_declared_versions_without_a_current_dict_is_empty():
    assert sw.declared_versions("CURRENT = None") == {}
    assert sw.declared_versions(None) == {}


def test_detect_reads_the_first_group():
    assert sw.detect("ARG PYTHON_VERSION=3.12.13", r"ARG PYTHON_VERSION=(\d+\.\d+)") == "3.12"
    assert sw.detect("nothing here", r"ARG PYTHON_VERSION=(\d+\.\d+)") is None
    assert sw.detect(None, r"(x)") is None


def test_lts_rule_keeps_long_term_cycles_only():
    rows = [row("24", "2025-05-06", "2028-04-30", "2025-10-28"), row("25", "2025-10-15", "2026-06-01")]

    assert [cycle["cycle"] for cycle in sw.cycles_from_endoflife(rows, "lts")] == ["24"]


def test_major_rule_drops_rapid_releases():
    rows = [row("8.0", "2024-10-31", "2029-10-31"), row("8.2", "2025-09-30", "2026-07-31"), row("9.0", "2026-09-30", "2031-10-31")]

    assert [cycle["cycle"] for cycle in sw.cycles_from_endoflife(rows, "major")] == ["8.0", "9.0"]


def test_extra_cycle_replaces_the_fetched_cycle_of_its_major():
    rows = [row("7", "2019-04-10", "2026-01-15"), row("8.19", "2025-07-29", "2027-07-15")]
    extra = [{"cycle": "7.17", "start": "2022-02", "end": "2026-01"}]

    cycles = sw.cycles_from_endoflife(rows, "latest_minor_per_major", extra)

    assert [(cycle["cycle"], cycle["start"], cycle["end"]) for cycle in cycles] == [
        ("7.17", "2022-02-01", "2026-01-01"),
        ("8.19", "2025-07-29", "2027-07-15"),
    ]


def test_shown_cycles_keep_one_before_current_and_mark_it():
    cycles = sw.cycles_from_endoflife([row(f"3.{minor}", f"20{12 + minor}-10-01", f"20{17 + minor}-10-31") for minor in range(9, 15)])

    shown = sw.shown_cycles(cycles, "3.11", TODAY)

    assert [cycle["cycle"] for cycle in shown] == ["3.10", "3.11", "3.12", "3.13", "3.14"]
    assert [cycle["cycle"] for cycle in shown if cycle["current"]] == ["3.11"]


def test_open_edx_releases_run_until_the_next_one():
    cycles = sw.open_edx_cycles({"ulmo": date(2026, 1, 5), "verawood": date(2026, 7, 29)}, [{"name": "Willow", "date": "2027-02"}])

    assert [(cycle["cycle"], cycle["end"]) for cycle in cycles] == [
        ("Ulmo", "2026-07-29"),
        ("Verawood", "2027-02-01"),
        ("Willow", "2027-08-01"),
    ]


@pytest.mark.parametrize(
    ("declared", "detected", "end", "expected"),
    [
        (sw.Declared(sw.DECLARED, "3.11"), TUTOR, date(2028, 10, 31), sw.DRIFT),
        (sw.Declared(sw.FOLLOWS_TUTOR), TUTOR, date(2026, 1, 1), sw.EOL),
        (sw.Declared(sw.DECLARED, "3.12"), TUTOR, date(2027, 8, 31), sw.EOL_SOON),
        (sw.Declared(sw.DECLARED, "3.12"), TUTOR, date(2028, 10, 31), sw.OK),
        (sw.Declared(sw.DECLARED, "3.12"), TUTOR, None, sw.OK),
        (sw.Declared(sw.DECLARED, "3.11"), sw.Detected(None, "overhangio/tutor", None, "x"), None, sw.UNKNOWN),
    ],
)
def test_status(declared, detected, end, expected):
    assert sw.status(declared, detected, end, TODAY, 12)[0] == expected


def test_drift_wins_over_end_of_life():
    state, reason = sw.status(sw.Declared(sw.DECLARED, "3.11"), TUTOR, date(2025, 1, 1), TODAY, 12)

    assert state == sw.DRIFT
    assert reason == "barcalendar.py declares 3.11; overhangio/tutor v22.0.3 ships 3.12"


def test_releases_that_do_not_track_eol_are_ok_when_matching():
    assert sw.status(sw.Declared(sw.FOLLOWS_TUTOR), TUTOR, date(2026, 11, 1), TODAY, 12, tracks_eol=False)[0] == sw.OK


def test_product_record_links_the_detected_file():
    cycles = sw.cycles_from_endoflife([row("3.12", "2023-10-02", "2028-10-31")])

    record = sw.product_record(
        "python", {"label": "Python", "eol_slug": "python"}, cycles, sw.Declared(sw.DECLARED, "3.12"), TUTOR,
        today=TODAY, eol_soon_months=12,
    )

    assert record["status"] == sw.OK
    assert record["current_end"] == "2028-10-31"
    assert record["detected_url"] == "https://github.com/overhangio/tutor/blob/v22.0.3/tutor/templates/build/openedx/Dockerfile"
    assert record["source_note"] == "https://endoflife.date/python"


def test_summary_counts_every_status():
    assert sw.summary([{"status": sw.DRIFT}, {"status": sw.OK}, {"status": sw.OK}]) == {
        sw.DRIFT: 1, sw.EOL: 0, sw.EOL_SOON: 0, sw.OK: 2, sw.UNKNOWN: 0,
    }

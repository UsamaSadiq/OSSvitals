from datetime import date

from collectors.fleet.signals.licence_watch import licence_file, matches_declared, watch

TODAY = date(2026, 10, 31)
MIT = {"present": True, "path": "LICENSE", "sha": "aaa", "spdx": "MIT"}


def test_the_licence_file_is_read_at_the_branch_we_track():
    routes = {"repos/up/demo/license?ref=release%2F7.x": {"path": "LICENSE.txt", "sha": "s1", "license": {"spdx_id": "NOASSERTION"}}}
    assert licence_file(routes.get, "up/demo", "release/7.x") == {"present": True, "path": "LICENSE.txt", "sha": "s1", "spdx": None}


def test_no_licence_file_is_a_finding_not_a_failure():
    assert licence_file(lambda _: None, "up/demo", "main") == {"present": False, "path": None, "sha": None, "spdx": None}


def test_declared_and_detected_licences_match_across_variants_and_unknown_is_not_a_mismatch():
    assert matches_declared("GPL-3.0-or-later", "GPL-3.0") is True
    assert matches_declared("MIT", "Apache-2.0") is False
    assert matches_declared("BUSL-1.1", None) is None
    assert matches_declared(None, "MIT") is None


def test_the_first_run_is_a_baseline():
    record = watch(MIT, None, "MIT", TODAY, 30)
    assert (record["changed_on"], record["previous_spdx"], record["matches_declared"]) == (None, None, True)


def test_a_new_file_hash_marks_today_and_keeps_what_it_was():
    record = watch({**MIT, "sha": "bbb", "spdx": None}, {**MIT, "changed_on": None}, "MIT", TODAY, 30)
    assert (record["changed_on"], record["previous_spdx"]) == ("2026-10-31", "MIT")


def test_a_change_stays_marked_for_the_notice_window_then_clears():
    previous = {**MIT, "changed_on": "2026-10-10", "previous_spdx": "Apache-2.0"}
    assert watch(MIT, previous, "MIT", TODAY, 30)["changed_on"] == "2026-10-10"
    assert watch(MIT, previous, "MIT", TODAY, 21)["changed_on"] is None


def test_a_removed_licence_file_counts_as_a_change():
    record = watch({"present": False, "path": None, "sha": None, "spdx": None}, MIT, "MIT", TODAY, 30)
    assert (record["present"], record["changed_on"]) == (False, "2026-10-31")


def test_no_licence_file_on_both_runs_is_not_a_change():
    absent = {"present": False, "path": None, "sha": None, "spdx": None}
    assert watch(absent, {**absent, "changed_on": None}, "MIT", TODAY, 30)["changed_on"] is None


def test_an_added_licence_file_is_recorded_as_previously_absent():
    absent = {"present": False, "path": None, "sha": None, "spdx": None}
    record = watch(MIT, absent, "MIT", TODAY, 30)
    assert (record["changed_on"], record["previous_present"]) == ("2026-10-31", False)


def test_the_change_and_what_it_was_clear_together_after_the_window():
    previous = {**MIT, "changed_on": "2026-09-01", "previous_spdx": "Apache-2.0", "previous_present": True}
    record = watch(MIT, previous, "MIT", TODAY, 30)
    assert (record["changed_on"], record["previous_spdx"], record["previous_present"]) == (None, None, None)

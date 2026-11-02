import pytest

from scripts.collect_maintenance import COLLECTORS, MERGEABLE, select_collectors


def test_a_full_run_takes_the_enabled_collectors_in_order():
    assert select_collectors(None, merge_run=False, enabled=["fix_prs", "waves"]) == ["waves", "fix_prs"]


def test_a_merge_run_skips_org_wide_collectors_even_when_enabled():
    assert select_collectors(None, merge_run=True, enabled=list(COLLECTORS)) == list(MERGEABLE)


def test_naming_a_collector_the_org_turned_off_is_an_error():
    with pytest.raises(SystemExit, match="catalog"):
        select_collectors(["catalog"], merge_run=False, enabled=["waves"])


def test_named_collectors_run_as_given_when_enabled():
    assert select_collectors(["waves"], merge_run=False, enabled=list(COLLECTORS)) == ["waves"]

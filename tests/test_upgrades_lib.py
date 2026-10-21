from __future__ import annotations

from dashboard.lib.upgrades import campaign_gaps, campaign_rule, done_rule, gaps


def test_done_rule_lists_required_and_forbidden_paths():
    wave = {"done": {"present": ["pyproject.toml"], "absent": ["setup.py", "setup.cfg"]}}
    assert done_rule(wave) == "has `pyproject.toml`; no `setup.py`, `setup.cfg`"
    assert done_rule({}) == ""


def test_gaps_lists_additions_then_removals():
    assert gaps(["uv.lock"], ["requirements"]) == "add uv.lock, remove requirements"
    assert gaps(None, None) == ""


def test_campaign_rule_names_package_and_floor():
    assert campaign_rule({"package": "certifi", "min_version": "2026.10.19"}) == (
        "every pin of `certifi` in requirements files and `uv.lock` is 2026.10.19 or later"
    )


def test_campaign_gaps_group_paths_by_version():
    stale = [
        {"path": "uv.lock", "version": "2026.7.22"},
        {"path": "requirements/base.txt", "version": "2026.7.22"},
        {"path": "requirements/old.txt", "version": "2024.7.4"},
    ]
    assert campaign_gaps(stale) == "2024.7.4 in requirements/old.txt; 2026.7.22 in requirements/base.txt, uv.lock"
    assert campaign_gaps(None) == ""

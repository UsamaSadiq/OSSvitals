from __future__ import annotations

from dashboard.lib.upgrades import done_rule, gaps


def test_done_rule_lists_required_and_forbidden_paths():
    wave = {"done": {"present": ["pyproject.toml"], "absent": ["setup.py", "setup.cfg"]}}
    assert done_rule(wave) == "has `pyproject.toml`; no `setup.py`, `setup.cfg`"
    assert done_rule({}) == ""


def test_gaps_lists_additions_then_removals():
    assert gaps(["uv.lock"], ["requirements"]) == "add uv.lock, remove requirements"
    assert gaps(None, None) == ""

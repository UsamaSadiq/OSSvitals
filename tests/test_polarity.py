"""Inverted health-check columns are flipped once at load time."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from dashboard.lib import data, fixtures, polarity, trends

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "data"
TOX = "tox_ini.uses_whitelist_externals"


def test_flip_value_handles_bools_strings_and_blanks():
    assert [polarity.flip_value(v) for v in [True, False, "True", "no", "1", None, "maybe"]] == [
        False, True, "False", "yes", "0", None, "maybe",
    ]


def test_normalise_flips_only_the_configured_columns():
    frame = pd.DataFrame({TOX: [True, False], "exists.README.rst": [True, False]})

    flipped = polarity.normalise(frame)

    assert flipped[TOX].tolist() == [False, True]
    assert flipped["exists.README.rst"].tolist() == [True, False]
    assert frame[TOX].tolist() == [True, False]


def test_normalise_without_the_column_returns_the_frame_unchanged():
    frame = pd.DataFrame({"exists.README.rst": [True]})
    assert polarity.normalise(frame) is frame


def test_snapshot_and_history_loaders_read_the_tox_column_as_healthy(monkeypatch):
    monkeypatch.setenv(fixtures.FIXTURE_DIR_ENV, str(FIXTURE_DIR))
    raw = pd.read_csv(FIXTURE_DIR / "dashboard_main.csv")

    snapshot = data.load_snapshot()
    history = trends.load_history()

    assert int(raw[TOX].sum()) == 1
    assert int(snapshot[TOX].sum()) == len(raw) - 1
    assert history and all(item.df[TOX].dtype == bool and item.df[TOX].mean() > 0.9 for item in history)

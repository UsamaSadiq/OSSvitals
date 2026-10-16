"""Normalise health-check columns whose raw value is inverted.

Most repo-health columns record True when the repository is healthy. A few record
True when a defect is present (``tox_ini.uses_whitelist_externals`` is True when the
deprecated key is still used). ``check_descriptions.yaml`` lists those under
``inverted`` and every loader flips them once, so every consumer, from scoring to
the Repo Detail page, reads True as healthy.
"""
from __future__ import annotations

from typing import Any

import pandas as pd

from dashboard.lib.config import DEFAULT_ORG, get_config

FLIP = {"true": "False", "false": "True", "1": "0", "0": "1", "yes": "no", "no": "yes"}


def inverted_checks(org: str = DEFAULT_ORG) -> list[str]:
    return [str(name) for name in get_config("check_descriptions", org).get("inverted", [])]


def flip_value(value: Any) -> Any:
    if isinstance(value, bool):
        return not value
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return value
    return FLIP.get(str(value).strip().lower(), value)


def normalise(frame: pd.DataFrame, org: str = DEFAULT_ORG) -> pd.DataFrame:
    columns = [name for name in inverted_checks(org) if name in frame.columns]
    if not columns:
        return frame
    flipped = frame.copy()
    for name in columns:
        flipped[name] = flipped[name].map(flip_value)
    return flipped

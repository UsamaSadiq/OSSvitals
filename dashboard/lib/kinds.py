"""Shared by every tenant kind: kind defaults in ``_kinds/<kind>/defaults.yaml``, tenant overrides merged over them."""
from __future__ import annotations

from pathlib import Path

from dashboard.lib.config import CONFIG_DIR, KINDS_DIR
from dashboard.lib.merging import merge

__all__ = ["KINDS_DIR", "defaults_path", "merge", "override_path"]


def defaults_path(kind: str) -> Path:
    return KINDS_DIR / kind / "defaults.yaml"


def override_path(org: str, kind: str) -> Path:
    return CONFIG_DIR / org / f"{kind}.yaml"


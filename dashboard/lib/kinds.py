"""Shared by every tenant kind: kind defaults in ``_kinds/<kind>/defaults.yaml``, tenant overrides merged over them."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from dashboard.lib.config import CONFIG_DIR

KINDS_DIR = CONFIG_DIR / "_kinds"


def defaults_path(kind: str) -> Path:
    return KINDS_DIR / kind / "defaults.yaml"


def override_path(org: str, kind: str) -> Path:
    return CONFIG_DIR / org / f"{kind}.yaml"


def merge(base: Any, override: Any) -> Any:
    """Mappings merge key by key; anything else in ``override`` replaces ``base``."""
    if not (isinstance(base, dict) and isinstance(override, dict)):
        return override
    return {**base, **{key: merge(base.get(key), value) for key, value in override.items()}}

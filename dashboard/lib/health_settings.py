"""A health tenant's settings: the kind defaults with the tenant's optional ``health.yaml`` merged over them."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from dashboard.lib.config import read_config_file
from dashboard.lib.kinds import defaults_path, merge, override_path
from dashboard.lib.schema import validate_config_data

KIND = "health"


class HealthConfigError(ValueError):
    pass


def read_override(path: Path) -> dict[str, Any]:
    """No file means the defaults; a file that cannot be read must stop the run, not fall back to them."""
    if not path.is_file():
        return {}
    try:
        override = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as error:
        raise HealthConfigError(f"{path} is not valid YAML: {error}") from error
    if not isinstance(override, dict):
        raise HealthConfigError(f"{path} must be a mapping")
    return override


def build_settings(defaults: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    values = merge(defaults, override)
    validate_config_data(KIND, values, strict=True)
    return values


@lru_cache(maxsize=8)
def load_settings(org: str) -> dict[str, Any]:
    return build_settings(read_config_file(defaults_path(KIND)), read_override(override_path(org, KIND)))

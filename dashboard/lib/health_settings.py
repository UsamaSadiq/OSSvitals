"""A health tenant's settings: the kind defaults with the tenant's optional ``health.yaml`` merged over them."""
from __future__ import annotations

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
    """The default pages are every route the health web module has, so any other page is a typo that would hide one."""
    if not isinstance(defaults.get("pages"), list):
        raise HealthConfigError(f"{defaults_path(KIND)} is missing or has no pages")
    values = merge(defaults, override)
    validate_config_data(KIND, values, strict=True)
    unknown = [page for page in values["pages"] if page not in defaults["pages"]]
    if unknown:
        raise HealthConfigError(f"unknown pages: {', '.join(unknown)}")
    return values


def load_settings(org: str) -> dict[str, Any]:
    return build_settings(read_config_file(defaults_path(KIND)), read_override(override_path(org, KIND)))

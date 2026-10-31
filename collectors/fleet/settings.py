"""A fleet tenant's settings: the kind defaults with the tenant's ``fleet.yaml`` merged over them."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from collectors.fleet.registry import BY_KEY, SIGNALS
from dashboard.lib.config import CONFIG_DIR, read_config_file
from dashboard.lib.schema import validate_config_data

KIND = "fleet"
DEFAULTS_PATH = CONFIG_DIR / "_kinds" / KIND / "defaults.yaml"


class FleetConfigError(ValueError):
    pass


@dataclass(frozen=True)
class FleetSettings:
    org: str
    values: dict[str, Any]

    @property
    def production(self) -> str:
        return self.values["branches"]["production"]

    @property
    def staging(self) -> str | None:
        return self.values["branches"].get("staging")

    @property
    def fork_release_tag(self) -> str:
        return self.values["fork_release_tag"]

    @property
    def statuses(self) -> list[dict[str, Any]]:
        return self.values["statuses"]

    def signal(self, key: str) -> dict[str, Any]:
        return self.values["signals"][key]

    def collects(self, key: str) -> bool:
        return self.signal(key)["collect"]

    def enabled_signals(self, *tiers: str) -> list[str]:
        """In registry order, which is also the order of the fields in a fork record."""
        return [signal.key for signal in SIGNALS if signal.tier in tiers and self.collects(signal.key)]


def merge(base: Any, override: Any) -> Any:
    """Mappings merge key by key; anything else in ``override`` replaces ``base``."""
    if not (isinstance(base, dict) and isinstance(override, dict)):
        return override
    return {**base, **{key: merge(base.get(key), value) for key, value in override.items()}}


def _threshold_owner(threshold: str) -> str | None:
    return next((signal.key for signal in SIGNALS if threshold in signal.thresholds), None)


def _without_thresholds_of(statuses: list[dict[str, Any]], disabled: set[str]) -> list[dict[str, Any]]:
    return [{key: value for key, value in status.items() if _threshold_owner(key) not in disabled} for status in statuses]


def _lookup(values: dict[str, Any], dotted: str) -> Any:
    for part in dotted.split("."):
        values = values.get(part) if isinstance(values, dict) else None
    return values


def _invalid_patterns(values: dict[str, Any]) -> list[str]:
    try:
        re.compile(values["fork_release_tag"])
    except re.error as error:
        return [f"fork_release_tag is not a valid regex: {error}"]
    return []


def _problems(values: dict[str, Any]) -> list[str]:
    on = {key for key, signal in values["signals"].items() if signal["collect"]}
    problems = [f"signal {key} needs {need}, which is off" for key in on for need in BY_KEY[key].needs if need not in on]
    problems += [f"signal {key} needs {path}" for key in on for path in BY_KEY[key].requires if _lookup(values, path) is None]
    problems += _invalid_patterns(values)
    for status in values["statuses"]:
        for threshold in status:
            owner = _threshold_owner(threshold)
            if owner and owner not in on:
                problems.append(f"status {status['key']} uses {threshold}, but signal {owner} is off")
    return problems


def build_settings(org: str, defaults: dict[str, Any], override: dict[str, Any]) -> FleetSettings:
    """Default statuses drop the thresholds of signals the tenant turned off; a tenant's own statuses must not use them."""
    values = merge(defaults, override)
    if "statuses" not in override:
        disabled = {key for key, signal in values["signals"].items() if not signal["collect"]}
        values = {**values, "statuses": _without_thresholds_of(values["statuses"], disabled)}
    validate_config_data(KIND, values, strict=True)
    problems = _problems(values)
    if problems:
        raise FleetConfigError(f"{org} fleet settings: " + "; ".join(problems))
    return FleetSettings(org, values)


def read_override(path: Path) -> dict[str, Any]:
    """A tenant file that is missing or unreadable must stop the run, not fall back to defaults that publish wrong data."""
    if not path.is_file():
        raise FleetConfigError(f"{path} is missing")
    try:
        override = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as error:
        raise FleetConfigError(f"{path} is not valid YAML: {error}") from error
    if not isinstance(override, dict):
        raise FleetConfigError(f"{path} must be a mapping")
    return override


def load_settings(org: str) -> FleetSettings:
    return build_settings(org, read_config_file(DEFAULTS_PATH), read_override(CONFIG_DIR / org / f"{KIND}.yaml"))

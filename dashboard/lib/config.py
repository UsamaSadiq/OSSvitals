from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from pathlib import Path

import yaml

from dashboard.lib.merging import merge
from dashboard.lib.schema import validate_config_data

logger = logging.getLogger(__name__)

LIB_DIR = Path(__file__).resolve().parent
DASHBOARD_DIR = LIB_DIR.parent
CONFIG_DIR = DASHBOARD_DIR / "config"
KINDS_DIR = CONFIG_DIR / "_kinds"
TENANTS_PATH = CONFIG_DIR / "tenants.json"
DEFAULT_ORG = "openedx"
ORG_ENV_VAR = "DASHBOARD_ORG"


def read_config_file(path: str | Path) -> dict:
    """Read and parse a YAML config file from dashboard/config."""
    raw_path = Path(path)
    config_path = raw_path if raw_path.is_absolute() else DASHBOARD_DIR / raw_path

    try:
        with config_path.open("r", encoding="utf-8") as stream:
            return yaml.safe_load(stream) or {}
    except Exception as exc:  # noqa: BLE001 - deliberate resilience
        logger.warning("Failed to read config at %s: %s", config_path, exc)
        return {}


def active_org() -> str:
    return os.environ.get(ORG_ENV_VAR, "").strip() or DEFAULT_ORG


def get_config(section: str, org: str | None = None) -> dict:
    """Get configuration by section name from org config directory.

    Without an explicit org, the org named by DASHBOARD_ORG is used.
    """
    return _load_config(section, org or active_org())


@lru_cache(maxsize=1)
def _tenant_kinds() -> dict[str, str]:
    index = json.loads(TENANTS_PATH.read_text(encoding="utf-8"))
    validate_config_data("tenants", index, strict=True)
    return {org: tenant["kind"] for org, tenant in index.items()}


def tenant_kind(org: str) -> str | None:
    """None for an org outside tenants.json, which then reads only its own folder."""
    return _tenant_kinds().get(org)


def _section_files(section: str, org: str) -> list[Path]:
    """The kind's default for the section, then the org's own file, which is merged over it."""
    kind = tenant_kind(org)
    candidates = [KINDS_DIR / kind / f"{section}.yaml"] if kind else []
    return [path for path in [*candidates, CONFIG_DIR / org / f"{section}.yaml"] if path.exists()]


@lru_cache(maxsize=32)
def _load_config(section: str, org: str) -> dict:
    files = _section_files(section, org)
    if not files:
        return {}
    payload: dict = {}
    for path in files:
        payload = merge(payload, read_config_file(path))
    validate_config_data(section, payload, strict=False)
    return payload


@lru_cache(maxsize=1)
def get_feature_flags() -> dict:
    """Load feature flags from root config file.

    When the environment variable DASHBOARD_ENABLE_ALL_FEATURES is set to
    "true" (case-insensitive), every known flag is forced to True regardless
    of the YAML values. Intended for local development and per-client
    feature previews.
    """
    root_flags = CONFIG_DIR / "feature_flags.yaml"
    payload = read_config_file(root_flags) if root_flags.exists() else {}
    validate_config_data("feature_flags", payload, strict=False)

    if os.environ.get("DASHBOARD_ENABLE_ALL_FEATURES", "").strip().lower() == "true":
        payload = {key: True for key in payload}

    return payload

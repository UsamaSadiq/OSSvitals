"""Strip private names (for example client branch names) from published files.

Patterns come from the org's ``redact.yaml`` and apply to every string value and
string key in a payload.
"""
from __future__ import annotations

import re
from typing import Any

from dashboard.lib.config import get_config

DEFAULT_REPLACEMENT = "[redacted]"


def compile_patterns(config: dict[str, Any]) -> list[re.Pattern[str]]:
    return [re.compile(pattern) for pattern in config.get("patterns") or []]


def _redact_text(text: str, patterns: list[re.Pattern[str]], replacement: str) -> str:
    for pattern in patterns:
        text = pattern.sub(replacement, text)
    return text


def _unique_key(key: str, taken: dict[str, Any]) -> str:
    candidate, number = key, 1
    while candidate in taken:
        number += 1
        candidate = f"{key} ({number})"
    return candidate


def _redact_mapping(mapping: dict[Any, Any], patterns: list[re.Pattern[str]], replacement: str) -> dict[Any, Any]:
    result: dict[Any, Any] = {}
    for key, item in mapping.items():
        new_key = _redact_text(key, patterns, replacement) if isinstance(key, str) else key
        result[_unique_key(new_key, result) if new_key in result else new_key] = redact(item, patterns, replacement)
    return result


def redact(value: Any, patterns: list[re.Pattern[str]], replacement: str = DEFAULT_REPLACEMENT) -> Any:
    if not patterns:
        return value
    if isinstance(value, str):
        return _redact_text(value, patterns, replacement)
    if isinstance(value, dict):
        return _redact_mapping(value, patterns, replacement)
    if isinstance(value, list):
        return [redact(item, patterns, replacement) for item in value]
    return value


def redact_for_org(value: Any, org: str | None = None) -> Any:
    """``value`` with the org's ``redact.yaml`` applied; the org named by DASHBOARD_ORG when ``org`` is None."""
    config = get_config("redact", org)
    return redact(value, compile_patterns(config), config.get("replacement", DEFAULT_REPLACEMENT))

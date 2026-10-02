"""Strip private names (for example client branch names) from published files.

Patterns come from the org's ``redact.yaml`` and apply to every string value in
a payload, keys excluded.
"""
from __future__ import annotations

import re
from typing import Any

DEFAULT_REPLACEMENT = "[redacted]"


def compile_patterns(config: dict[str, Any]) -> list[re.Pattern[str]]:
    return [re.compile(pattern) for pattern in config.get("patterns") or []]


def redact(value: Any, patterns: list[re.Pattern[str]], replacement: str = DEFAULT_REPLACEMENT) -> Any:
    if not patterns:
        return value
    if isinstance(value, str):
        for pattern in patterns:
            value = pattern.sub(replacement, value)
        return value
    if isinstance(value, dict):
        return {key: redact(item, patterns, replacement) for key, item in value.items()}
    if isinstance(value, list):
        return [redact(item, patterns, replacement) for item in value]
    return value

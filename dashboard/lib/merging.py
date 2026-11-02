from __future__ import annotations

from typing import Any


def merge(base: Any, override: Any) -> Any:
    """Mappings merge key by key; anything else in ``override`` replaces ``base``."""
    if not (isinstance(base, dict) and isinstance(override, dict)):
        return override
    return {**base, **{key: merge(base.get(key), value) for key, value in override.items()}}

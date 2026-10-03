"""Text the Upgrades page derives from the waves config and wave records."""
from __future__ import annotations

from typing import Any


def done_rule(wave: dict[str, Any]) -> str:
    done = wave.get("done") or {}
    parts = []
    if done.get("present"):
        parts.append("has " + ", ".join(f"`{path}`" for path in done["present"]))
    if done.get("absent"):
        parts.append("no " + ", ".join(f"`{path}`" for path in done["absent"]))
    return "; ".join(parts)


def gaps(missing: list[str] | None, leftover: list[str] | None) -> str:
    parts = [f"add {path}" for path in missing or []] + [f"remove {path}" for path in leftover or []]
    return ", ".join(parts)

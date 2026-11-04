"""Text the Upgrades page derives from the waves config and wave records."""
from __future__ import annotations

from typing import Any


def content_rules(wave: dict[str, Any]) -> list[dict[str, str]]:
    return (wave.get("done") or {}).get("file_contains") or []


def rule_label(rule: dict[str, str]) -> str:
    return rule.get("label") or f"{rule['pattern']} in {rule['path']}"


def done_rule(wave: dict[str, Any]) -> str:
    done = wave.get("done") or {}
    parts = []
    if done.get("present"):
        parts.append("has " + ", ".join(f"`{path}`" for path in done["present"]))
    if done.get("absent"):
        parts.append("no " + ", ".join(f"`{path}`" for path in done["absent"]))
    parts += [f"`{rule['path']}` has {rule_label(rule)}" for rule in content_rules(wave)]
    return "; ".join(parts)


def gaps(missing: list[str] | None, leftover: list[str] | None) -> str:
    parts = [f"add {path}" for path in missing or []] + [f"remove {path}" for path in leftover or []]
    return ", ".join(parts)


def campaign_rule(campaign: dict[str, Any]) -> str:
    return f"every pin of `{campaign['package']}` in requirements files and `uv.lock` is {campaign['min_version']} or later"


def campaign_gaps(stale: list[dict[str, Any]] | None) -> str:
    by_version: dict[str, list[str]] = {}
    for pin in stale or []:
        by_version.setdefault(pin["version"], []).append(pin["path"])
    return "; ".join(f"{version} in {', '.join(sorted(paths))}" for version, paths in sorted(by_version.items()))

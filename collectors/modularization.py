"""Modularization facts about one monolith repo: extracted XBlocks, legacy frontend size, extracted-package pins.

Pure functions only; the network calls live in ``scripts/collect_maintenance.py``.
"""
from __future__ import annotations

import re
from typing import Any

SOURCE = "Monolith source files and git trees on GitHub"
EXTRACTED = "extracted"
BUILT_IN = "built_in"


def block_label(toggle: str, acronyms: list[str]) -> str:
    return " ".join(word if word in acronyms else word.title() for word in toggle.split("_"))


def extracted_blocks(text: str | None, pattern: str, acronyms: list[str] | None = None) -> list[dict[str, Any]]:
    """One record per toggle the pattern matches; group 1 is the block name, group 2 is True or False."""
    found = re.findall(pattern, text or "", flags=re.MULTILINE)
    return [
        {
            "block": block_label(name, acronyms or []),
            "toggle": name,
            "status": EXTRACTED if value == "True" else BUILT_IN,
        }
        for name, value in sorted(set(found))
    ]


def is_legacy_frontend(path: str, rules: dict[str, Any]) -> bool:
    top = path.split("/", 1)[0]
    extension = path.rsplit(".", 1)[-1] if "." in path else ""
    return (
        top in rules["roots"]
        and extension in rules["extensions"]
        and not any(marker in path for marker in rules.get("exclude", []))
    )


def legacy_frontend_count(paths: list[str], rules: dict[str, Any]) -> int:
    return sum(1 for path in paths if is_legacy_frontend(path, rules))


def pinned_versions(text: str | None, packages: list[str]) -> dict[str, str | None]:
    pins = dict(re.findall(r"^([A-Za-z0-9_.-]+)==([^\s;#]+)", text or "", flags=re.MULTILINE))
    by_lower = {name.lower(): version for name, version in pins.items()}
    return {package: by_lower.get(package.lower()) for package in packages}


def summary(blocks: list[dict[str, Any]]) -> dict[str, int]:
    extracted = sum(1 for block in blocks if block["status"] == EXTRACTED)
    total = len(blocks)
    return {
        "blocks": total,
        "extracted": extracted,
        "percent_extracted": round(extracted / total * 100) if total else 0,
    }

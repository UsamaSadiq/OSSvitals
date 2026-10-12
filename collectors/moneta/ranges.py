from __future__ import annotations

import re
from typing import Any

VERSION = re.compile(r"\d+(?:\.\d+)+")
CLAUSE = re.compile(r"^\s*(<=|>=|<|>|=)?\s*v?(\d+(?:\.\d+)*)")

Version = tuple[int, ...]


def version_key(tag: str) -> Version:
    return tuple(int(part) for part in VERSION.search(tag).group().split("."))


def _padded(left: Version, right: Version) -> tuple[Version, Version]:
    width = max(len(left), len(right))
    return left + (0,) * (width - len(left)), right + (0,) * (width - len(right))


def _satisfies(version: Version, operator: str, bound: Version) -> bool:
    left, right = _padded(version, bound)
    return {"<": left < right, "<=": left <= right, ">": left > right, ">=": left >= right, "=": left == right}[operator]


def in_range(version: Version, vulnerable_range: str) -> bool | None:
    """True/False for a GHSA `vulnerable_version_range`; None when a clause cannot be read."""
    clauses = [CLAUSE.match(clause) for clause in vulnerable_range.split(",")]
    if not vulnerable_range.strip() or not all(clauses):
        return None
    return all(_satisfies(version, match.group(1) or "=", tuple(int(part) for part in match.group(2).split("."))) for match in clauses)


def affects(version: Version | None, advisory: dict[str, Any]) -> bool | None:
    """Whether the advisory's vulnerable ranges include `version`; None when that cannot be told."""
    ranges = [item.get("vulnerable_version_range") for item in advisory.get("vulnerabilities") or []]
    verdicts = [in_range(version, text) if version and text else None for text in ranges]
    if any(verdict is True for verdict in verdicts):
        return True
    return False if verdicts and all(verdict is False for verdict in verdicts) else None

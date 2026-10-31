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


def _introduced_major(vulnerable_range: str) -> int:
    lower_bounds = [match for match in map(CLAUSE.match, vulnerable_range.split(",")) if match and match.group(1) in (">=", ">", "=", None)]
    return min((int(match.group(2).split(".")[0]) for match in lower_bounds), default=0)


def is_patched(version: Version, patched_versions: str | None, vulnerable_range: str) -> bool:
    """A fix on the version's own major line at or below it covers it. With no fix on that line, a fix on an
    earlier line covers it when the flaw was introduced before this major (later lines inherit the fix)."""
    fixes = [tuple(int(part) for part in found.split(".")) for found in VERSION.findall(patched_versions or "")]
    own = [fix for fix in fixes if fix[0] == version[0]]
    if own:
        return any(_padded(fix, version)[0] <= _padded(fix, version)[1] for fix in own)
    return _introduced_major(vulnerable_range) < version[0] and any(fix[0] < version[0] for fix in fixes)


def _vulnerable(version: Version | None, vulnerability: dict[str, Any]) -> bool | None:
    text = vulnerability.get("vulnerable_version_range")
    if not version or not text:
        return None
    verdict = in_range(version, text)
    return False if verdict and is_patched(version, vulnerability.get("patched_versions"), text) else verdict


def affects(version: Version | None, advisory: dict[str, Any]) -> bool | None:
    """Whether the advisory's vulnerable ranges include `version` and no fix covers it; None when that cannot be told."""
    verdicts = [_vulnerable(version, vulnerability) for vulnerability in advisory.get("vulnerabilities") or []]
    if any(verdict is True for verdict in verdicts):
        return True
    return False if verdicts and all(verdict is False for verdict in verdicts) else None

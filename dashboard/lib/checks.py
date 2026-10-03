"""Check-column vocabulary shared by every page that reads pass/fail cells.

Callers that disagree on which columns count as checks pass ``skip_prefixes``
explicitly, so the difference is visible at the call site.
"""
from __future__ import annotations

import re
from collections.abc import Callable, Iterable

import pandas as pd

from dashboard.lib.ordering import rank

PASS_TOKENS = frozenset({"true", "1", "yes"})
FAIL_TOKENS = frozenset({"false", "0", "no", "fail", "failing"})

NON_CHECK_PREFIXES = ("github.", "language_bytes.")

CATEGORY_GROUPS: dict[str, Callable[[str], bool]] = {
    "File Existence": lambda c: c.startswith("exists."),
    "CI / Tooling": lambda c: c in {"github_actions", "renovate.configured", "travis_ci.active", "travis_yml.parsable", "tox_tox_section"},
    "Dependencies": lambda c: c.startswith("dependabot.") or c.startswith("dependencies."),
    "Documentation": lambda c: c in {"readthedocs_config.exists", "docs.build_badge"},
    "README": lambda c: c.startswith("readme."),
}


def is_check_column(name: str, *, skip_prefixes: tuple[str, ...] = NON_CHECK_PREFIXES) -> bool:
    return "." in name and not name.startswith(skip_prefixes)


def check_columns(columns: Iterable[str], *, skip_prefixes: tuple[str, ...] = NON_CHECK_PREFIXES) -> list[str]:
    return [col for col in columns if is_check_column(col, skip_prefixes=skip_prefixes)]


def classify(value: object) -> str:
    token = str(value).strip().lower()
    if token in PASS_TOKENS:
        return "pass"
    if token in FAIL_TOKENS:
        return "fail"
    return "unknown"


def failing_mask(series: pd.Series) -> pd.Series:
    return series.astype(str).str.lower().isin(FAIL_TOKENS)


def failing_counts(frame: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    """Checks with at least one failing repository, most-failed first."""
    rows = [
        {"check": col, "failing": count}
        for col in columns
        if (count := int(failing_mask(frame[col]).sum())) > 0
    ]
    if not rows:
        return pd.DataFrame(columns=["check", "failing"])
    return rank(pd.DataFrame(rows), "failing", ascending=False, tiebreak="check")


def category_columns(columns: Iterable[str]) -> dict[str, list[str]]:
    usable = check_columns(columns)
    return {name: [c for c in usable if predicate(c)] for name, predicate in CATEGORY_GROUPS.items()}


def category_stats(row: pd.Series, columns: Iterable[str]) -> tuple[int, int, int]:
    buckets = [classify(row.get(col, "")) for col in columns]
    return buckets.count("pass"), buckets.count("fail"), buckets.count("unknown")


def category_pass_rates(frame: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for name, predicate in CATEGORY_GROUPS.items():
        usable = [c for c in frame.columns if predicate(c)]
        if not usable:
            continue
        values = frame[usable].astype(str).apply(lambda s: s.str.lower())
        pass_count = values.isin(PASS_TOKENS).sum().sum()
        total = len(frame) * len(usable)
        rate = (pass_count / total) * 100 if total else 0
        rows.append({"category": name, "pass_rate": round(rate, 2)})
    return pd.DataFrame(rows)


def coverage(series: pd.Series) -> tuple[float, float | None]:
    """Return (populated %, pass %) for a check column."""
    values = series.fillna("").astype(str).str.strip()
    populated_pct = round(float(values.ne("").mean()) * 100, 1) if len(values) else 0.0
    lowered = values.str.lower()
    passes = lowered.isin(PASS_TOKENS)
    fails = lowered.isin(FAIL_TOKENS)
    denom = int((passes | fails).sum())
    pass_pct = round(int(passes.sum()) / denom * 100, 1) if denom else None
    return populated_pct, pass_pct


OTHER_GROUP = "Other checks"


def _in_group(check: str, group: dict) -> bool:
    pattern = group.get("pattern")
    return check in set(group.get("explicit", [])) or bool(pattern and re.match(pattern, check))


def catalog_groups(checks: list[str], groups_config: list[dict]) -> list[tuple[str, list[str]]]:
    """Checks per configured group in config order, then the ungrouped ones under "Other checks".

    A check matching several groups is listed in each, as the catalog always has.
    """
    grouped = [
        (group.get("name", "Ungrouped"), [check for check in checks if _in_group(check, group)])
        for group in groups_config
    ]
    non_empty = [(name, members) for name, members in grouped if members]
    seen = {check for _, members in non_empty for check in members}
    ungrouped = [check for check in checks if check not in seen]
    return non_empty + ([(OTHER_GROUP, ungrouped)] if ungrouped else [])

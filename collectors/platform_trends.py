"""Stability trends of one monolith repo from its git history: commits, authors, Python size and churn per month.

Pure functions only; the git calls live in ``collectors/platform_history.py``.
"""
from __future__ import annotations

import re
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date
from typing import Any

SOURCE = "Monolith git history on GitHub"
NOREPLY = "noreply"
PERSONAL = "personal"
UNKNOWN = "unknown"
OTHER = "other"
NOREPLY_DOMAIN = "users.noreply.github.com"
LOCAL_SUFFIXES = (".local", ".lan", ".internal", ".localdomain", ".home")


@dataclass(frozen=True)
class FileChange:
    path: str
    added: int
    deleted: int


@dataclass(frozen=True)
class Commit:
    sha: str
    month: str
    author: str
    email: str
    subject: str
    changes: tuple[FileChange, ...] = field(default=())


def month_key(day: date) -> str:
    return f"{day.year:04d}-{day.month:02d}"


def months_between(first: str, last: str) -> list[str]:
    """Every ``YYYY-MM`` from ``first`` to ``last``, both included."""
    year, month = (int(part) for part in first.split("-"))
    end = tuple(int(part) for part in last.split("-"))
    months = []
    while (year, month) <= end:
        months.append(f"{year:04d}-{month:02d}")
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return months


def month_end(month: str) -> date:
    """The first day after ``month``."""
    year, number = (int(part) for part in month.split("-"))
    return date(year + 1, 1, 1) if number == 12 else date(year, number + 1, 1)


def previous_month(day: date) -> str:
    return month_key(date(day.year - 1, 12, 1) if day.month == 1 else date(day.year, day.month - 1, 1))


def renamed_path(path: str) -> str:
    """The new path of a numstat rename (``a/{b => c}/d`` or ``a => b``); other paths unchanged."""
    if " => " not in path:
        return path
    braced = re.match(r"^(.*)\{(.*) => (.*)\}(.*)$", path)
    if braced:
        prefix, _, new, suffix = braced.groups()
        return re.sub("/{2,}", "/", f"{prefix}{new}{suffix}").lstrip("/")
    return path.split(" => ", 1)[1]


def is_counted_python(path: str, rules: dict[str, Any]) -> bool:
    extension = path.rsplit(".", 1)[-1] if "." in path.rsplit("/", 1)[-1] else ""
    return extension in rules["extensions"] and not any(re.search(pattern, path) for pattern in rules.get("exclude", []))


def is_bot(commit: Commit, pattern: str) -> bool:
    return re.search(pattern, f"{commit.author} <{commit.email}>", flags=re.IGNORECASE) is not None


def is_mechanical(commit: Commit, rules: dict[str, Any]) -> bool:
    """A sweep over many files or a lint-only change: real work, but not a sign of how the code base is moving."""
    return len(commit.changes) > rules["max_files"] or any(
        re.search(pattern, commit.subject) for pattern in rules.get("subject_patterns", [])
    )


def python_churn(commit: Commit, rules: dict[str, Any]) -> tuple[int, int]:
    counted = [change for change in commit.changes if is_counted_python(change.path, rules)]
    return sum(change.added for change in counted), sum(change.deleted for change in counted)


def email_bucket(email: str, personal_domains: Iterable[str]) -> str:
    """The organisation an author email points at: its domain, or a bucket for addresses that name no organisation."""
    domain = email.rsplit("@", 1)[-1].strip().lower() if "@" in email else ""
    if domain == NOREPLY_DOMAIN or domain.endswith(f".{NOREPLY_DOMAIN}"):
        return NOREPLY
    if domain in {name.lower() for name in personal_domains}:
        return PERSONAL
    if "." not in domain or domain.endswith(LOCAL_SUFFIXES):
        return UNKNOWN
    return domain


@dataclass
class Tally:
    commits: int = 0
    bot_commits: int = 0
    mechanical_commits: int = 0
    python_added: int = 0
    python_deleted: int = 0
    authors: set[str] = field(default_factory=set)
    author_commits: Counter = field(default_factory=Counter)

    def counts(self) -> dict[str, int]:
        return {
            "commits": self.commits,
            "authors": len(self.authors),
            "python_added": self.python_added,
            "python_deleted": self.python_deleted,
            "bot_commits": self.bot_commits,
            "mechanical_commits": self.mechanical_commits,
        }


def _add(tally: Tally, commit: Commit, rules: dict[str, Any]) -> None:
    if is_bot(commit, rules["bot_pattern"]):
        tally.bot_commits += 1
        return
    if is_mechanical(commit, rules["mechanical"]):
        tally.mechanical_commits += 1
        return
    added, deleted = python_churn(commit, rules["python"])
    tally.commits += 1
    tally.python_added += added
    tally.python_deleted += deleted
    tally.authors.add(commit.email.lower())
    tally.author_commits[commit.email.lower()] += 1


def tallies(commits: Iterable[Commit], months: list[str], rules: dict[str, Any]) -> tuple[dict[str, Tally], dict[str, Tally]]:
    """Per-month and per-year tallies; distinct authors are counted per period, so a year is not the sum of its months."""
    by_month = {month: Tally() for month in months}
    by_year = {month[:4]: Tally() for month in months}
    for commit in commits:
        if commit.month not in by_month:
            continue
        _add(by_month[commit.month], commit, rules)
        _add(by_year[commit.month[:4]], commit, rules)
    return by_month, by_year


def organisations(tally: Tally, rules: dict[str, Any]) -> list[dict[str, Any]]:
    """Authors and commits per email domain, largest first.

    Domains past ``top``, and domains with fewer than ``min_authors`` authors (a one-person domain names that
    person), fold into one ``other`` row.
    """
    authors: Counter = Counter()
    commits: Counter = Counter()
    for email, count in tally.author_commits.items():
        bucket = email_bucket(email, rules.get("personal_domains", []))
        authors[bucket] += 1
        commits[bucket] += count
    buckets = {NOREPLY, PERSONAL, UNKNOWN}
    domains = sorted((name for name in authors if name not in buckets), key=lambda name: (-authors[name], -commits[name], name))
    eligible = [name for name in domains if authors[name] >= rules["min_authors"]]
    shown = eligible[: rules["top"]]
    folded = [name for name in domains if name not in shown]
    rows = [{"name": name, "kind": "domain", "authors": authors[name], "commits": commits[name]} for name in shown]
    if folded:
        rows.append({
            "name": OTHER,
            "kind": OTHER,
            "domains": len(folded),
            "authors": sum(authors[name] for name in folded),
            "commits": sum(commits[name] for name in folded),
        })
    rows += [
        {"name": bucket, "kind": bucket, "authors": authors[bucket], "commits": commits[bucket]}
        for bucket in (NOREPLY, PERSONAL, UNKNOWN)
        if authors[bucket]
    ]
    return rows


def month_records(by_month: dict[str, Tally], python_lines: dict[str, int | None]) -> list[dict[str, Any]]:
    return [{"month": month, **tally.counts(), "python_lines": python_lines.get(month)} for month, tally in by_month.items()]


def year_records(
    by_year: dict[str, Tally],
    python_lines: dict[str, int | None],
    *,
    since: str,
    through: str,
    organisation_rules: dict[str, Any],
) -> list[dict[str, Any]]:
    """One row per year; ``python_lines`` is the year's last collected month.

    A year is complete when the series covers all twelve of its months, so the year in progress and a first year
    that starts after January are marked as partial.
    """
    rows = []
    for year in sorted(by_year):
        last_month = through if year == through[:4] else f"{year}-12"
        rows.append({
            "year": int(year),
            "complete": last_month.endswith("-12") and since <= f"{year}-01",
            "through": last_month,
            **by_year[year].counts(),
            "python_lines": python_lines.get(last_month),
            "organisations": organisations(by_year[year], organisation_rules),
        })
    return rows


def summary(years: list[dict[str, Any]]) -> dict[str, Any]:
    """First and latest complete year, for the headline tiles."""
    complete = [row for row in years if row["complete"]]
    if not complete:
        return {}
    first, latest = complete[0], complete[-1]
    fields = ("commits", "authors", "python_lines")
    return {
        "first_year": first["year"],
        "latest_year": latest["year"],
        "first": {name: first[name] for name in fields},
        "latest": {name: latest[name] for name in fields},
    }

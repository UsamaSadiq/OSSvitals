"""Read side of the catalog snapshot published by the collect-maintenance workflow.

The collector owns the finding codes and their wording (``metadata.findings``);
everything here only reshapes the published records for the pages.
"""
from __future__ import annotations

from typing import Any

import pandas as pd

from dashboard.lib.schema import REPO_COL

CATALOG_FILE = "catalog.json"
PROBLEM = "problem"
RELATIONS = {"depends_on": "Depends on", "subcomponent_of": "Part of", "dependency_of": "Dependency of"}
RELATION_STATUS = {"known": "In catalog", "not_in_catalog": "Not in catalog", "placeholder": "Template placeholder"}
GRADE_COLUMNS = ["score_letter", "score_composite"]


def legend(payload: dict[str, Any]) -> dict[str, dict[str, str]]:
    return payload["metadata"].get("findings") or {}


def record_for(payload: dict[str, Any] | None, repo: str) -> dict[str, Any] | None:
    if payload is None:
        return None
    return next((entry for entry in payload["records"] if entry.get(REPO_COL) == repo), None)


def finding_labels(entry: dict[str, Any], findings_legend: dict[str, dict[str, str]]) -> list[tuple[str, str]]:
    """``(severity, label)`` for each finding on a record, problems first."""
    labelled = [
        (findings_legend.get(code, {}).get("severity", PROBLEM), findings_legend.get(code, {}).get("label", code))
        for code in entry.get("findings", [])
    ]
    return sorted(labelled, key=lambda item: item[0] != PROBLEM)


def finding_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """One row per finding code present in the snapshot, problems first, then by count."""
    findings_legend = legend(payload)
    repos_by_code: dict[str, list[str]] = {}
    for entry in payload["records"]:
        for code in entry.get("findings", []):
            repos_by_code.setdefault(code, []).append(entry[REPO_COL])
    rows = [
        {
            "code": code,
            "label": findings_legend.get(code, {}).get("label", code),
            "severity": findings_legend.get(code, {}).get("severity", PROBLEM),
            "repos": sorted(repos),
        }
        for code, repos in repos_by_code.items()
    ]
    return sorted(rows, key=lambda row: (row["severity"] != PROBLEM, -len(row["repos"]), row["code"]))


def components_frame(payload: dict[str, Any], scored: pd.DataFrame) -> pd.DataFrame:
    """One row per repo with its declared catalog fields and today's grade."""
    frame = pd.DataFrame(payload["records"])
    for column in ["type", "lifecycle", "owner", "release", "findings"]:
        if column not in frame.columns:
            frame[column] = None
    frame = frame.assign(
        findings=frame["findings"].apply(lambda value: value if isinstance(value, list) else []),
        has_file=frame["has_file"].fillna(False).astype(bool),
    )
    grades = scored[[REPO_COL, *GRADE_COLUMNS]] if set(GRADE_COLUMNS) <= set(scored.columns) else None
    if grades is not None:
        frame = frame.merge(grades, on=REPO_COL, how="left")
    return frame.assign(finding_count=frame["findings"].apply(len))


def relation_rows(payload: dict[str, Any]) -> list[dict[str, str]]:
    """Every declared relation across the org, with the status the collector resolved."""
    return [
        {
            REPO_COL: entry[REPO_COL],
            "relation": RELATIONS.get(relation["relation"], relation["relation"]),
            "target": relation["target"],
            "status": RELATION_STATUS.get(relation["status"], relation["status"]),
        }
        for entry in payload["records"]
        for relation in entry.get("relations") or []
    ]

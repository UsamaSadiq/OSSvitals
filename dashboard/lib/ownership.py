"""Owner-level views of the snapshot: one summary row per owner, and an owner's repos.

Owners come from ``catalog-info.yaml`` (``spec.owner``, via ``ownership.owner_name``).
GitHub names are case-insensitive, so owners are matched on a lower-cased key and
shown with their original spelling.
"""
from __future__ import annotations

import pandas as pd

from dashboard.lib.ordering import rank
from dashboard.lib.schema import REPO_COL
from dashboard.lib.scoring import DEFAULT_LETTER_GRADES
from dashboard.lib.stewardship import (
    LIFECYCLE_COL,
    NEEDS_MAINTAINER,
    OWNER_KIND_COL,
    OWNER_NAME_COL,
    RELEASE_COL,
    SINGLE_PERSON,
    TEAM,
)

OWNER_KEY = "owner_key"
UNKNOWN_KIND = "not stated"


def owner_key(name: object) -> str:
    return "" if pd.isna(name) else str(name).strip().lower()


def owner_type(name: str, kind: str, *, unmaintained_group: str) -> str:
    if owner_key(name) == owner_key(unmaintained_group):
        return NEEDS_MAINTAINER
    if kind == "user":
        return SINGLE_PERSON
    if kind == "group":
        return TEAM
    return UNKNOWN_KIND


def _with_keys(df: pd.DataFrame) -> pd.DataFrame:
    if OWNER_NAME_COL not in df.columns:
        return df.iloc[0:0].assign(**{OWNER_KEY: pd.Series(dtype=str)})
    keyed = df.assign(**{OWNER_KEY: df[OWNER_NAME_COL].map(owner_key)})
    return keyed[keyed[OWNER_KEY] != ""]


def owner_summary(df: pd.DataFrame, *, unmaintained_group: str, at_risk_repos: set[str]) -> pd.DataFrame:
    """One row per owner, most repos first, index reset so row positions are stable."""
    keyed = _with_keys(df)
    if keyed.empty:
        return pd.DataFrame(columns=["owner", "owner_type", "repo_count", "avg_score", "d_or_f", "at_risk", OWNER_KEY])
    rows = []
    for key, group in keyed.groupby(OWNER_KEY, sort=False):
        first = group.iloc[0]
        rows.append(
            {
                "owner": str(first[OWNER_NAME_COL]).strip(),
                "owner_type": owner_type(
                    str(first[OWNER_NAME_COL]),
                    str(first.get(OWNER_KIND_COL, "") or "").strip().lower(),
                    unmaintained_group=unmaintained_group,
                ),
                "repo_count": len(group),
                "avg_score": round(float(group["score_composite"].mean()), 1),
                "d_or_f": int(group["score_letter"].isin(["D", "F"]).sum()),
                "at_risk": int(group[REPO_COL].isin(at_risk_repos).sum()),
                OWNER_KEY: key,
            }
        )
    summary = pd.DataFrame(rows)
    return summary.sort_values(
        ["repo_count", "avg_score", OWNER_KEY], ascending=[False, False, True], kind="mergesort"
    ).reset_index(drop=True)


def repos_for_owner(df: pd.DataFrame, key: str) -> pd.DataFrame:
    """The owner's repositories, weakest score first."""
    keyed = _with_keys(df)
    owned = keyed[keyed[OWNER_KEY] == owner_key(key)]
    columns = [REPO_COL, "score_composite", "score_letter", "score_activity", LIFECYCLE_COL, RELEASE_COL]
    present = [column for column in columns if column in owned.columns]
    return (
        owned[present]
        .rename(columns={LIFECYCLE_COL: "lifecycle", RELEASE_COL: "release"})
        .sort_values(["score_composite", REPO_COL], kind="mergesort")
        .reset_index(drop=True)
    )


def grade_mix(repos: pd.DataFrame) -> dict[str, int]:
    counts = repos["score_letter"].value_counts() if "score_letter" in repos.columns else pd.Series(dtype=int)
    return {letter: int(counts.get(letter, 0)) for letter in DEFAULT_LETTER_GRADES}


# catalog-info.yaml (spec.owner) is the primary source; the Google-Sheet
# theme/squad/priority columns are a secondary, 2U-only source.
COVERAGE_COLUMNS = [
    "ownership.owner_name",
    "ownership.owner",
    "ownership.theme",
    "ownership.squad",
    "ownership.priority",
]
UNASSIGNED = "Unassigned"


def _filled(series: pd.Series) -> pd.Series:
    return series.fillna("").astype(str).str.strip().ne("")


def has_text_data(df: pd.DataFrame, column: str) -> bool:
    return column in df.columns and bool(_filled(df[column]).any())


def ownership_coverage(df: pd.DataFrame) -> float:
    """Percent of repos with any ownership field set."""
    existing = [col for col in COVERAGE_COLUMNS if col in df.columns]
    if df.empty or not existing:
        return 0.0
    populated = pd.Series(False, index=df.index)
    for col in existing:
        populated = populated | _filled(df[col])
    return round(float(populated.mean()) * 100, 2)


def _bucket(value: object) -> str:
    normalized = str(value).strip()
    return normalized if normalized else UNASSIGNED


def group_summary(df: pd.DataFrame, column: str) -> pd.DataFrame:
    """Repo count, average score and D/F count per value of ``column``, largest first."""
    if column not in df.columns:
        return pd.DataFrame()
    grouped = df.assign(**{column: df[column].map(_bucket)})
    summary = (
        grouped.groupby(column, as_index=False)
        .agg(
            repo_count=(REPO_COL, "count"),
            avg_score=("score_composite", "mean"),
            d_or_f=("score_letter", lambda series: int(series.isin(["D", "F"]).sum())),
        )
        .pipe(rank, ["repo_count", "avg_score"], ascending=[False, False], tiebreak=column)
    )
    return summary.assign(avg_score=summary["avg_score"].round(2))

#!/usr/bin/env python3
"""Exit 1 and write a Markdown report when any published data source is stale.

Every org folder on the ``data`` branch with ``views/meta.json`` is checked, so a new
tenant needs no change here. A tenant that also configures a ``csv_url`` gets its
upstream sources checked as well.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from pathlib import Path

import requests

from dashboard.lib.clock import now_utc
from dashboard.lib.config import get_config
from dashboard.lib.freshness import DEFAULT_MAX_AGE_DAYS, SourceStatus, max_age_days_from_hours, report, status, to_date

DATA_BRANCH_URL = "https://github.com/UsamaSadiq/OSSvitals/blob/data"


def _get(url: str) -> requests.Response:
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    return response


def _csv_timestamp(url: str) -> object:
    rows = csv.DictReader(io.StringIO(_get(url).text))
    return max((row.get("TIMESTAMP", "") for row in rows), default="")


def _metadata_date(url: str, field: str) -> object:
    return _get(url).json().get("metadata", {}).get(field)


def _upstream_sources(cfg: dict) -> list[tuple[str, str, callable]]:
    maintenance = str(cfg.get("maintenance_base_url", "")).rstrip("/")
    return [
        ("openedx repo health CSV", cfg["csv_url"], lambda url: _csv_timestamp(url)),
        ("Pre-computed scores", cfg["scores_url"], lambda url: _metadata_date(url, "snapshot_timestamp")),
        ("Upgrade jobs", f"{maintenance}/upgrade_jobs.json", lambda url: _metadata_date(url, "generated_at")),
        ("uv wave", f"{maintenance}/waves/uv_pyproject.json", lambda url: _metadata_date(url, "generated_at")),
        ("Redundant PRs", f"{maintenance}/redundant_prs.json", lambda url: _metadata_date(url, "generated_at")),
    ]


def _orgs(data_dir: Path) -> list[str]:
    return sorted(path.name for path in data_dir.iterdir() if (path / "views" / "meta.json").is_file())


def _meta_status(data_dir: Path, org: str, today) -> SourceStatus:
    name = f"{org} views"
    url = f"{DATA_BRANCH_URL}/{org}/views/meta.json"
    try:
        meta = json.loads((data_dir / org / "views" / "meta.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return status(name, url, None, today=today, max_age_days=DEFAULT_MAX_AGE_DAYS, detail=type(exc).__name__)
    limit = max_age_days_from_hours(meta.get("stale_threshold_hours"))
    return status(name, url, to_date(meta.get("metadata", {}).get("generated_at")), today=today, max_age_days=limit)


def _upstream_statuses(org: str, today) -> list[SourceStatus]:
    cfg = get_config("data_source", org)
    if not cfg.get("csv_url"):
        return []
    results = []
    for name, url, read in _upstream_sources(cfg):
        try:
            results.append(status(name, url, to_date(read(url)), today=today, max_age_days=DEFAULT_MAX_AGE_DAYS))
        except Exception as exc:  # noqa: BLE001 - an unreadable source is reported as stale
            results.append(
                status(name, url, None, today=today, max_age_days=DEFAULT_MAX_AGE_DAYS, detail=type(exc).__name__)
            )
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--data-dir", type=Path, required=True, help="Checkout of the data branch.")
    args = parser.parse_args()

    today = now_utc().date()
    statuses: list[SourceStatus] = []
    for org in _orgs(args.data_dir):
        statuses.append(_meta_status(args.data_dir, org, today))
        statuses.extend(_upstream_statuses(org, today))

    args.report.write_text(report(statuses, max_age_days=DEFAULT_MAX_AGE_DAYS), encoding="utf-8")
    print(args.report.read_text(encoding="utf-8"))
    return 1 if not statuses or any(item.stale for item in statuses) else 0


if __name__ == "__main__":
    sys.exit(main())

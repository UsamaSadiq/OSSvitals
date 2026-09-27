#!/usr/bin/env python3
"""Exit 1 and write a Markdown report when any published data source is stale."""
from __future__ import annotations

import argparse
import csv
import io
import sys
from pathlib import Path

import requests

from dashboard.lib.clock import now_utc
from dashboard.lib.config import get_config
from dashboard.lib.freshness import report, status, to_date

MAX_AGE_DAYS = 2


def _get(url: str) -> requests.Response:
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    return response


def _csv_timestamp(url: str) -> object:
    rows = csv.DictReader(io.StringIO(_get(url).text))
    return max((row.get("TIMESTAMP", "") for row in rows), default="")


def _metadata_date(url: str, field: str) -> object:
    return _get(url).json().get("metadata", {}).get(field)


def _sources(cfg: dict) -> list[tuple[str, str, callable]]:
    maintenance = str(cfg.get("maintenance_base_url", "")).rstrip("/")
    return [
        ("openedx repo health CSV", cfg["csv_url"], lambda url: _csv_timestamp(url)),
        ("Pre-computed scores", cfg["scores_url"], lambda url: _metadata_date(url, "snapshot_timestamp")),
        ("Upgrade jobs", f"{maintenance}/upgrade_jobs.json", lambda url: _metadata_date(url, "generated_at")),
        ("uv wave", f"{maintenance}/waves/uv_pyproject.json", lambda url: _metadata_date(url, "generated_at")),
        ("Redundant PRs", f"{maintenance}/redundant_prs.json", lambda url: _metadata_date(url, "generated_at")),
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    today = now_utc().date()
    statuses = []
    for name, url, read in _sources(get_config("data_source")):
        try:
            statuses.append(status(name, url, to_date(read(url)), today=today, max_age_days=MAX_AGE_DAYS))
        except Exception as exc:  # noqa: BLE001 - an unreadable source is reported as stale
            statuses.append(status(name, url, None, today=today, max_age_days=MAX_AGE_DAYS, detail=type(exc).__name__))

    args.report.write_text(report(statuses, max_age_days=MAX_AGE_DAYS), encoding="utf-8")
    print(args.report.read_text(encoding="utf-8"))
    return 1 if any(item.stale for item in statuses) else 0


if __name__ == "__main__":
    sys.exit(main())

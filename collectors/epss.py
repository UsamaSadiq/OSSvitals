"""Read-only access to FIRST's EPSS scores: the estimated chance a CVE is exploited in the next 30 days."""
from __future__ import annotations

import time
from typing import Any

import requests

URL = "https://api.first.org/data/v1/epss"
BATCH = 50
RETRIES = 3
HEADERS = {"Accept": "application/json", "User-Agent": "ossvitals-collector (+https://github.com/UsamaSadiq/OSSvitals)"}


def _batch(cves: list[str]) -> dict[str, dict[str, Any]] | None:
    for attempt in range(RETRIES):
        try:
            response = requests.get(URL, params={"cve": ",".join(cves)}, headers=HEADERS, timeout=30)
            if response.ok:
                rows = response.json().get("data")
                if isinstance(rows, list):
                    return {row["cve"]: {"epss": float(row["epss"]), "percentile": float(row["percentile"]), "date": row.get("date")} for row in rows}
        except (requests.RequestException, ValueError, KeyError, TypeError):
            pass
        if attempt < RETRIES - 1:
            time.sleep(5 * (attempt + 1))
    return None


def scores(cves: list[str]) -> dict[str, dict[str, Any]] | None:
    """Scores for the CVEs FIRST knows; a CVE it has not scored is simply absent. None when FIRST cannot be read."""
    found: dict[str, dict[str, Any]] = {}
    for start in range(0, len(cves), BATCH):
        batch = _batch(cves[start : start + BATCH])
        if batch is None:
            return None
        found.update(batch)
    return found

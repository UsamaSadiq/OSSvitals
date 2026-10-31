"""Read-only access to FIRST's EPSS scores: the estimated chance a CVE is exploited in the next 30 days."""
from __future__ import annotations

import time
from typing import Any

import requests

URL = "https://api.first.org/data/v1/epss"
BATCH = 50
RETRIES = 3
TOO_MANY_REQUESTS = 429
MAX_RETRY_AFTER = 60
HEADERS = {"Accept": "application/json", "User-Agent": "ossvitals-collector (+https://github.com/UsamaSadiq/OSSvitals)"}


def _retry_after(response: requests.Response, attempt: int) -> float:
    """Honour Retry-After (seconds) when FIRST sends it, within a minute; otherwise back off as for other errors."""
    try:
        return min(float(response.headers.get("Retry-After", "")), MAX_RETRY_AFTER)
    except ValueError:
        return 5 * (attempt + 1)


def _batch(cves: list[str]) -> dict[str, dict[str, Any] | None] | None:
    """Every CVE asked about: its score, or None when FIRST has not scored it. None when FIRST cannot be read."""
    for attempt in range(RETRIES):
        try:
            response = requests.get(URL, params={"cve": ",".join(cves)}, headers=HEADERS, timeout=30)
            if response.status_code == TOO_MANY_REQUESTS:
                if attempt < RETRIES - 1:
                    time.sleep(_retry_after(response, attempt))
                continue
            if 400 <= response.status_code < 500:
                return None
            payload = response.json() if response.ok else None
            rows = payload.get("data") if isinstance(payload, dict) else None
            if isinstance(rows, list):
                found = {row["cve"]: {"epss": float(row["epss"]), "percentile": float(row["percentile"]), "date": row.get("date")} for row in rows}
                return {cve: found.get(cve) for cve in cves}
        except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError):
            pass
        if attempt < RETRIES - 1:
            time.sleep(5 * (attempt + 1))
    return None


def scores(cves: list[str]) -> dict[str, dict[str, Any] | None]:
    """Each CVE from a batch FIRST answered: its score, or None when unscored. CVEs of a batch that failed are
    left out, so the caller can tell "not scored" from "could not ask"."""
    found: dict[str, dict[str, Any] | None] = {}
    for start in range(0, len(cves), BATCH):
        batch = _batch(cves[start : start + BATCH])
        if batch is None:
            break
        found.update(batch)
    return found

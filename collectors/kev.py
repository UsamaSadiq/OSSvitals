"""Read-only access to CISA's catalog of known exploited vulnerabilities (one download per run)."""
from __future__ import annotations

import time
from typing import Any

import requests

URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
RETRIES = 3
HEADERS = {"Accept": "application/json", "User-Agent": "ossvitals-collector (+https://github.com/UsamaSadiq/OSSvitals)"}


def catalogue() -> dict[str, Any] | None:
    """The full catalog, or None when it cannot be read; callers fall back to their cached copy."""
    for attempt in range(RETRIES):
        try:
            response = requests.get(URL, headers=HEADERS, timeout=60)
            if response.ok:
                payload = response.json()
                if isinstance(payload, dict) and isinstance(payload.get("vulnerabilities"), list):
                    return payload
        except (requests.RequestException, ValueError):
            pass
        time.sleep(5 * (attempt + 1))
    return None

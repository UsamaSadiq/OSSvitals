"""Read-only access to the endoflife.date API, one request per product."""
from __future__ import annotations

import time
from typing import Any

import requests

API = "https://endoflife.date/api/{slug}.json"
RETRIES = 4
HEADERS = {"Accept": "application/json", "User-Agent": "ossvitals-collector (+https://github.com/UsamaSadiq/OSSvitals)"}


def cycles(slug: str) -> list[dict[str, Any]] | None:
    """Every release cycle endoflife.date lists for ``slug``, or None when it cannot be read.

    endoflife.date drops connections under bursts, so failures back off and retry.
    """
    for attempt in range(RETRIES):
        try:
            response = requests.get(API.format(slug=slug), headers=HEADERS, timeout=30)
            if response.status_code == 404:
                return None
            if response.ok:
                payload = response.json()
                return payload if isinstance(payload, list) else None
        except (requests.RequestException, ValueError):
            pass
        time.sleep(5 * (attempt + 1))
    return None

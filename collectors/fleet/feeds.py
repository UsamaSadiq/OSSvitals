"""Outside feeds shared by every fork of one run: fetched once, cached on the data branch, never fatal."""
from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable

KEV_CACHE = "kev.json"


@dataclass(frozen=True)
class KevCatalogue:
    added: dict[str, str]
    version: str | None
    fetched_at: str
    from_cache: bool


def compact_kev(raw: dict[str, Any], fetched_at: datetime) -> dict[str, Any]:
    """Only what the signal reads: the 1.8 MB catalog shrinks to CVE ids and the day each was added."""
    return {
        "catalog_version": raw.get("catalogVersion"),
        "fetched_at": fetched_at.isoformat(),
        "added": {entry["cveID"]: entry.get("dateAdded") for entry in raw["vulnerabilities"] if isinstance(entry, dict) and entry.get("cveID")},
    }


def _catalogue(cache: dict[str, Any], from_cache: bool) -> KevCatalogue:
    return KevCatalogue(added=cache["added"], version=cache.get("catalog_version"), fetched_at=cache["fetched_at"], from_cache=from_cache)


CLOCK_SKEW = timedelta(hours=1)


def _fetched_at(cache: dict[str, Any]) -> datetime | None:
    try:
        fetched_at = datetime.fromisoformat(cache["fetched_at"])
    except (KeyError, TypeError, ValueError):
        return None
    return fetched_at if fetched_at.tzinfo else None


def fresh_enough(cache: Any, now: datetime, max_age_days: int) -> bool:
    """A cached copy that is malformed, naive, dated in the future or older than ``max_age_days`` is not used."""
    if not isinstance(cache, dict) or not isinstance(cache.get("added"), dict) or not cache["added"]:
        return False
    fetched_at = _fetched_at(cache)
    return fetched_at is not None and now - timedelta(days=max_age_days) <= fetched_at <= now + CLOCK_SKEW


class Feeds:
    """Each feed is fetched at most once per run, whichever worker thread asks first."""

    def __init__(
        self,
        fetch_kev: Callable[[], dict[str, Any] | None],
        kev_cache: dict[str, Any] | None,
        now: datetime,
        max_age_days: int,
        fetch_epss: Callable[[list[str]], dict[str, dict[str, Any]] | None] = lambda cves: None,
    ) -> None:
        self._fetch_kev = fetch_kev
        self._fetch_epss = fetch_epss
        self._epss_lock = threading.Lock()
        self._epss: dict[str, dict[str, Any] | None] = {}
        self._epss_failed = False
        self._kev_cache = kev_cache
        self._now = now
        self._max_age_days = max_age_days
        self._lock = threading.Lock()
        self._loaded = False
        self._kev_compact: dict[str, Any] | None = None
        self._kev: KevCatalogue | None = None

    def kev(self) -> KevCatalogue | None:
        """The live catalog, else a cached copy younger than ``max_age_days``, else None (the signal then fails this run)."""
        with self._lock:
            if not self._loaded:
                try:
                    self._load_kev()
                except (ValueError, TypeError, KeyError, AttributeError):
                    self._kev_compact, self._kev = None, None
                finally:
                    self._loaded = True
            return self._kev

    def _load_kev(self) -> None:
        fetched = self._compact_or_none(self._fetch_kev())
        if fetched and fetched["added"]:
            self._kev_compact = fetched
            self._kev = _catalogue(fetched, from_cache=False)
        elif fresh_enough(self._kev_cache, self._now, self._max_age_days):
            self._kev_compact = self._kev_cache
            self._kev = _catalogue(self._kev_cache, from_cache=True)

    def _compact_or_none(self, raw: dict[str, Any] | None) -> dict[str, Any] | None:
        """A live payload that cannot be read is treated like a failed fetch, so the cached copy still applies."""
        try:
            return compact_kev(raw, self._now) if raw else None
        except (TypeError, KeyError, AttributeError):
            return None

    def epss(self, cves: list[str]) -> dict[str, dict[str, Any]] | None:
        """Scores for ``cves``, each looked up at most once per run and shared across forks. After one failed lookup
        the run stops asking FIRST, and every later caller gets None (and falls back to its previous scores)."""
        with self._epss_lock:
            missing = sorted({cve for cve in cves if cve not in self._epss})
            if missing and not self._epss_failed:
                try:
                    found = self._fetch_epss(missing)
                except (ValueError, TypeError, KeyError, AttributeError):
                    found = None
                if found is None:
                    self._epss_failed = True
                else:
                    self._epss.update({cve: found.get(cve) for cve in missing})
            if any(cve not in self._epss for cve in cves):
                return None
            return {cve: score for cve in cves if (score := self._epss[cve])}

    def kev_cache_to_publish(self) -> dict[str, Any] | None:
        """The copy the next run falls back to; a cached copy keeps its original fetch time so it still ages out."""
        return self._kev_compact if self._loaded else None

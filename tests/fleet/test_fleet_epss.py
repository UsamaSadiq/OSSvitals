from datetime import datetime, timezone

import collectors.epss as epss_api
from collectors.fleet.feeds import Feeds
from collectors.fleet.signals.exploitability import exploitability

NOW = datetime(2026, 10, 31, tzinfo=timezone.utc)
RAW = {"catalogVersion": "v", "vulnerabilities": [{"cveID": "CVE-1", "dateAdded": "2026-10-02"}]}
MERGED = "2026-09-03T00:00:00Z"


def advisory(ghsa, cve):
    return {"ghsa_id": ghsa, "cve_id": cve, "severity": "high", "published_at": "2026-10-08T00:00:00Z", "vulnerabilities": []}


ADVISORIES = [advisory("GHSA-a", "CVE-1"), advisory("GHSA-b", "CVE-2"), advisory("GHSA-c", "CVE-3"), advisory("GHSA-d", None)]
SCORES = {"CVE-1": {"epss": 0.109, "percentile": 0.958, "date": "2026-10-30"}, "CVE-2": {"epss": 0.005, "percentile": 0.43, "date": "2026-10-30"}}


def feeds(fetch_epss):
    return Feeds(lambda: RAW, None, NOW, 7, fetch_epss)


def test_the_highest_scores_among_advisories_that_apply_and_how_many_are_likely_exploited():
    shared = feeds(lambda cves: SCORES)
    record = exploitability(ADVISORIES, None, MERGED, shared.kev(), shared.epss, None, 0.1)["epss"]
    assert (record["as_of"], record["from_previous"], record["likely"], record["min"]) == ("2026-10-30", False, 1, 0.1)
    assert [(item["cve_id"], item["epss"]) for item in record["top"]] == [("CVE-1", 0.109), ("CVE-2", 0.005)]
    assert record["scores"] == {"CVE-1": [0.109, 0.958], "CVE-2": [0.005, 0.43]}


def test_when_first_cannot_be_read_the_last_scores_are_kept_with_their_date():
    shared = feeds(lambda cves: None)
    previous = {"epss": {"as_of": "2026-10-29", "scores": {"CVE-1": [0.2, 0.97]}}}
    record = exploitability(ADVISORIES, None, MERGED, shared.kev(), shared.epss, previous, 0.1)
    assert record["known_exploited"][0]["cve_id"] == "CVE-1"
    assert (record["epss"]["as_of"], record["epss"]["from_previous"], record["epss"]["likely"]) == ("2026-10-29", True, 1)
    assert exploitability(ADVISORIES, None, MERGED, shared.kev(), shared.epss, None, 0.1)["epss"] is None


def test_scores_are_looked_up_once_per_cve_and_a_failure_stops_further_lookups_for_the_run():
    asked = []

    def fetch(cves):
        asked.append(cves)
        return SCORES

    shared = feeds(fetch)
    assert shared.epss(["CVE-1", "CVE-2"]) == SCORES
    assert shared.epss(["CVE-2", "CVE-3"]) == {"CVE-2": SCORES["CVE-2"]}
    assert asked == [["CVE-1", "CVE-2"], ["CVE-3"]]
    failing = []
    broken = feeds(lambda cves: failing.append(cves))
    assert broken.epss(["CVE-1"]) is None and broken.epss(["CVE-2"]) is None
    assert failing == [["CVE-1"]]


def test_cves_are_asked_in_batches_and_one_failed_batch_fails_the_lookup(monkeypatch):
    batches = []
    monkeypatch.setattr(epss_api, "_batch", lambda cves: batches.append(len(cves)) or {cve: {"epss": 0.0, "percentile": 0.0, "date": None} for cve in cves})
    assert len(epss_api.scores([f"CVE-{index}" for index in range(120)])) == 120
    assert batches == [50, 50, 20]
    monkeypatch.setattr(epss_api, "_batch", lambda cves: None)
    assert epss_api.scores(["CVE-1"]) is None

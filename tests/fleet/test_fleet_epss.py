from datetime import datetime, timezone

import collectors.epss as epss_api
from collectors.fleet.feeds import Feeds
from collectors.fleet.signals.exploitability import exploitability

NOW = datetime(2026, 10, 31, tzinfo=timezone.utc)
RAW = {"catalogVersion": "v", "vulnerabilities": [{"cveID": "CVE-9", "dateAdded": "2026-10-02"}]}
MERGED = "2026-09-03T00:00:00Z"


def advisory(ghsa, cve):
    return {"ghsa_id": ghsa, "cve_id": cve, "severity": "high", "published_at": "2026-10-08T00:00:00Z", "vulnerabilities": []}


ADVISORIES = [advisory("GHSA-a", "CVE-1"), advisory("GHSA-b", "CVE-2"), advisory("GHSA-c", "CVE-3"), advisory("GHSA-d", None)]
SCORES = {"CVE-1": {"epss": 0.109, "percentile": 0.958, "date": "2026-10-30"}, "CVE-2": {"epss": 0.005, "percentile": 0.43, "date": "2026-10-30"}, "CVE-3": None}


def feeds(fetch_epss):
    return Feeds(lambda: RAW, None, NOW, 7, fetch_epss)


def run(shared, previous=None, advisories=ADVISORIES):
    return exploitability(advisories, None, MERGED, shared.kev(), shared.epss, previous, 0.1)["epss"]


def test_the_highest_scores_among_advisories_that_apply_and_how_many_are_likely_exploited():
    record = run(feeds(lambda cves: {cve: SCORES[cve] for cve in cves}))
    assert (record["as_of"], record["from_previous"], record["likely"], record["min"]) == ("2026-10-30", False, 1, 0.1)
    assert [(item["cve_id"], item["epss"]) for item in record["top"]] == [("CVE-1", 0.109), ("CVE-2", 0.005)]
    assert record["scores"] == {"CVE-1": [0.109, 0.958], "CVE-2": [0.005, 0.43]}


def test_when_first_cannot_be_read_the_last_scores_are_kept_with_their_date():
    previous = {"epss": {"as_of": "2026-10-29", "scores": {"CVE-1": [0.2, 0.97]}}}
    record = run(feeds(lambda cves: {}), {"epss": previous["epss"]})
    assert (record["as_of"], record["from_previous"], record["likely"]) == ("2026-10-29", True, 1)
    assert run(feeds(lambda cves: {})) is None


def test_scores_fetched_this_run_are_kept_and_only_the_unknown_ones_fall_back():
    calls = []

    def fetch(cves):
        calls.append(cves)
        return {"CVE-1": SCORES["CVE-1"]} if len(calls) == 1 else {}

    shared = feeds(fetch)
    assert shared.epss(["CVE-1"]) == ({"CVE-1": SCORES["CVE-1"]}, set())
    assert shared.epss(["CVE-1", "CVE-2"]) == ({"CVE-1": SCORES["CVE-1"]}, {"CVE-2"})
    assert shared.epss(["CVE-3"]) == ({}, {"CVE-3"})
    assert calls == [["CVE-1"], ["CVE-2"]]
    previous = {"epss": {"as_of": "2026-10-28", "scores": {"CVE-1": [0.9, 0.99], "CVE-2": [0.15, 0.9]}}}
    record = run(shared, previous)
    assert {item["cve_id"]: item["epss"] for item in record["top"]} == {"CVE-1": 0.109, "CVE-2": 0.15}
    assert (record["from_previous"], record["as_of"], record["likely"]) == (True, "2026-10-28", 2)


def test_an_unscored_cve_is_remembered_and_not_asked_again():
    calls = []
    shared = feeds(lambda cves: calls.append(cves) or {cve: None for cve in cves})
    assert shared.epss(["CVE-3"]) == ({}, set())
    assert shared.epss(["CVE-3"]) == ({}, set())
    assert calls == [["CVE-3"]]


def test_nothing_to_score_publishes_no_epss_block():
    assert run(feeds(lambda cves: {}), advisories=[advisory("GHSA-d", None)]) is None
    previous = {"epss": {"as_of": "2026-10-29", "scores": {"CVE-7": [0.5, 0.99]}}}
    assert run(feeds(lambda cves: {}), previous) is None


def test_a_failed_batch_leaves_its_cves_out_and_answered_batches_are_kept(monkeypatch):
    batches = []

    def batch(cves):
        batches.append(len(cves))
        return None if len(batches) == 2 else {cve: None for cve in cves}

    monkeypatch.setattr(epss_api, "_batch", batch)
    found = epss_api.scores([f"CVE-{index}" for index in range(120)])
    assert batches == [50, 50]
    assert len(found) == 50


def test_a_response_that_is_not_an_object_is_retried_then_treated_as_unreadable(monkeypatch):
    class Response:
        ok, status_code = True, 200

        def json(self):
            return []

    calls = []
    monkeypatch.setattr(epss_api.requests, "get", lambda *args, **kwargs: calls.append(1) or Response())
    monkeypatch.setattr(epss_api.time, "sleep", lambda seconds: None)
    assert epss_api._batch(["CVE-1"]) is None
    assert len(calls) == epss_api.RETRIES

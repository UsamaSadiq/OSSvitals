from datetime import datetime, timezone

from collectors.fleet.signals.upstream_health import contributors, health, releases

NOW = datetime(2026, 10, 31, tzinfo=timezone.utc)
RECENT = int(datetime(2026, 9, 1, tzinfo=timezone.utc).timestamp())
OLD = int(datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp())


def person(login, recent, old=0, kind="User"):
    return {"author": {"login": login, "type": kind}, "weeks": [{"w": RECENT, "c": recent}, {"w": OLD, "c": old}]}


def test_the_fewest_people_behind_half_of_last_years_commits_ignoring_bots_and_older_work():
    stats = [person("ann", 50), person("bob", 30), person("cy", 20, old=500), person("dependabot[bot]", 900), person("ci", 400, kind="Bot")]
    assert contributors(stats, NOW) == {"commits": 100, "people": 3, "half_of_commits_by": 1, "top_share": 0.5}
    assert contributors([person("ann", 40), person("bob", 35), person("cy", 25)], NOW)["half_of_commits_by"] == 2


def test_no_commits_in_the_window_is_unknown_not_zero():
    assert contributors([person("ann", 0, old=10)], NOW) == {"commits": 0, "people": 0, "half_of_commits_by": None, "top_share": None}


def test_release_cadence_over_the_last_year():
    published = ["2026-10-20T00:00:00Z", "2026-09-20T00:00:00Z", "2026-08-01T00:00:00Z", "2025-01-01T00:00:00Z"]
    record = releases([{"published_at": day} for day in published], NOW)
    assert record == {"last_year": 3, "days_since_latest": 11, "median_gap_days": 40}
    assert releases([], NOW) == {"last_year": 0, "days_since_latest": None, "median_gap_days": None}


def test_contributor_counts_github_is_still_computing_are_unknown():
    assert health({}, [], NOW)["contributors"] is None

from datetime import datetime, timezone

from collectors.fleet.signals.upstream_health import contributors, fetch_stats, health, is_automation, releases

NOW = datetime(2026, 10, 31, tzinfo=timezone.utc)
RECENT = int(datetime(2026, 9, 1, tzinfo=timezone.utc).timestamp())
OLD = int(datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp())


def person(login, recent, old=0, kind="User"):
    return {"author": {"login": login, "type": kind}, "weeks": [{"w": RECENT, "c": recent}, {"w": OLD, "c": old}]}


def test_agents_and_automation_typed_as_users_are_not_people():
    for login in ["claude", "Claude", "cursoragent", "copilot-swe-agent", "github-actions", "outline-translations", "release-bot", "dependabot[bot]"]:
        assert is_automation({"login": login, "type": "User"}, []), login
    assert is_automation({"login": "ci", "type": "Bot"}, [])
    assert is_automation({"login": "deploy-helper", "type": "User"}, ["deploy-*"])
    assert not is_automation({"login": "tommoor", "type": "User"}, [])


def test_the_fewest_people_behind_half_of_last_years_commits():
    stats = [person("ann", 50), person("bob", 30), person("cy", 20, old=500), person("claude", 400), person("dependabot[bot]", 900)]
    record = contributors(stats, NOW)
    assert {key: record[key] for key in ("commits", "automated_commits", "people", "half_of_commits_by", "top_share", "truncated")} == {
        "commits": 100,
        "automated_commits": 1300,
        "people": 3,
        "half_of_commits_by": 1,
        "top_share": 0.5,
        "truncated": False,
    }
    assert record["as_of"] == "2026-10-31"
    assert contributors([person("ann", 40), person("bob", 35), person("cy", 25)], NOW)["half_of_commits_by"] == 2


def test_a_week_that_straddles_the_start_of_the_window_counts():
    straddling = int(datetime(2025, 10, 29, tzinfo=timezone.utc).timestamp())
    stats = [{"author": {"login": "ann", "type": "User"}, "weeks": [{"w": straddling, "c": 4}]}]
    assert contributors(stats, NOW)["commits"] == 4


def test_a_list_capped_by_github_is_marked_truncated():
    assert contributors([person(f"p{index}", 1) for index in range(100)], NOW)["truncated"] is True


def test_only_automation_in_the_window_is_unknown_concentration_not_zero_activity():
    record = contributors([person("dependabot[bot]", 90)], NOW)
    assert (record["commits"], record["automated_commits"], record["half_of_commits_by"]) == (0, 90, None)


def test_counts_still_being_computed_are_retried_then_the_last_ones_are_kept():
    answers = iter([{}, {}, [person("ann", 3)]])
    waits = []
    assert fetch_stats(lambda path: next(answers), "up/demo", waits.append) == [person("ann", 3)]
    assert len(waits) == 2
    assert fetch_stats(lambda path: {}, "up/demo", waits.append) is None
    remembered = {"contributors": {"commits": 7, "as_of": "2026-10-20"}}
    record = health(None, remembered, [], {"default_branch": "main"}, "main", NOW)
    assert record["contributors"] == {"commits": 7, "as_of": "2026-10-20"}
    assert health(None, None, [], None, "main", NOW)["contributors"] is None


def test_the_stats_branch_is_compared_with_the_branch_we_track():
    assert health([], None, [], {"default_branch": "main"}, "preview", NOW)["tracks_default_branch"] is False
    assert health([], None, [], {"default_branch": "preview"}, "preview", NOW)["tracks_default_branch"] is True


def test_release_cadence_over_the_last_year():
    published = ["2026-10-20T00:00:00Z", "2026-09-20T00:00:00Z", "2026-08-01T00:00:00Z", "2025-01-01T00:00:00Z"]
    assert releases([{"published_at": day} for day in published], NOW) == {"last_year": 3, "days_since_latest": 11, "median_gap_days": 40}
    assert releases([], NOW) == {"last_year": 0, "days_since_latest": None, "median_gap_days": None}


def test_a_longer_list_than_the_cap_is_complete():
    assert contributors([person(f"p{index}", 1) for index in range(272)], NOW)["truncated"] is False

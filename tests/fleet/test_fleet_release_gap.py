from datetime import datetime, timezone

import pytest

from collectors.fleet.release_gap import gap_level, release_gap, tag_release_gap

NOW = datetime(2026, 10, 12, tzinfo=timezone.utc)


def release(tag, published):
    return {"tag_name": tag, "published_at": published}


@pytest.mark.parametrize(
    ("base", "latest", "expected"),
    [
        ((1, 7, 1), (1, 7, 1), "none"),
        ((1, 7, 1), (1, 7, 3), "patch"),
        ((1, 7, 1), (1, 10, 1), "minor"),
        ((1, 7, 1), (2, 0, 0), "major"),
        ((0, 2, 8), (0, 3, 4), "major"),
        ((0, 9, 11), (0, 9, 12), "patch"),
        ((7, 2), (7, 2, 0), "none"),
        ((2, 0, 0), (1, 9, 9), "none"),
    ],
)
def test_gap_level_follows_semver_including_0x_minors(base, latest, expected):
    assert gap_level(base, latest) == expected


def test_release_gap_counts_newer_releases_and_ages_the_oldest_one_we_lack():
    releases = [
        release("v1.10.1", "2026-10-01T00:00:00Z"),
        release("v1.8.0", "2026-07-14T00:00:00Z"),
        release("v1.7.2", "2026-06-20T00:00:00Z"),
        release("v1.7.1", "2026-06-01T00:00:00Z"),
        release("v1.6.0", "2026-05-01T00:00:00Z"),
    ]
    assert release_gap("v1.7.1", "v26.9.0", releases, NOW) == {
        "base": "v1.7.1",
        "base_ref": "v26.9.0",
        "latest": "v1.10.1",
        "releases_behind": 3,
        "level": "minor",
        "days_behind": 114,
    }


def test_release_gap_is_zero_on_the_newest_release():
    gap = release_gap("v4.18.0", "v26.10.0", [release("v4.18.0", "2026-10-01T00:00:00Z")], NOW)
    assert (gap["releases_behind"], gap["level"], gap["days_behind"]) == (0, "none", 0)


def test_release_gap_is_unknown_without_a_base_or_releases():
    assert release_gap(None, "foss-main", [release("v1.0.0", "2026-10-01T00:00:00Z")], NOW) is None
    assert release_gap("v1.0.0", "foss-main", [], NOW) is None


def tag(name, sha=None):
    return {"name": name, "commit": {"sha": sha or name}}


def test_a_tag_only_upstream_dates_the_gap_from_the_first_tag_we_lack_on_each_line():
    asked = []

    def tag_date(missing):
        asked.append(missing["name"])
        return "2026-09-12T00:00:00Z"

    gap = tag_release_gap("7.2.1", "v26.10.1", [tag("7.3.0"), tag("7.2.2"), tag("7.2.1")], NOW, tag_date)
    assert gap == {"base": "7.2.1", "base_ref": "v26.10.1", "latest": "7.3.0", "releases_behind": 2, "level": "minor", "days_behind": 30}
    assert asked == ["7.2.2", "7.3.0"]


def test_a_tag_only_upstream_dates_the_gap_from_the_oldest_line_not_the_lowest_version():
    dates = {"7.0.0": "2026-06-01T00:00:00Z", "6.5.3": "2026-10-10T00:00:00Z"}
    gap = tag_release_gap("6.5.2", "v26.10.1", [tag("7.0.0"), tag("6.5.3"), tag("6.5.2")], NOW, lambda missing: dates[missing["name"]])
    assert (gap["level"], gap["days_behind"]) == ("major", 133)


def test_a_tag_only_upstream_needs_no_date_when_we_have_its_newest_tag():
    gap = tag_release_gap("7.2.2", "v26.10.1", [tag("7.2.2"), tag("7.2.1")], NOW, lambda _: pytest.fail("no date needed"))
    assert (gap["releases_behind"], gap["level"], gap["days_behind"]) == (0, "none", 0)

import pytest

from collectors.moneta.ranges import affects, in_range, version_key


@pytest.mark.parametrize(
    ("version", "text", "expected"),
    [
        ((4, 17, 1), "< 4.18.0", True),
        ((4, 18, 0), "< 4.18.0", False),
        ((4, 18), ">= 4.18.0, < 4.19", True),
        ((3, 9, 9), ">= 4.0.0, < 4.18.0", False),
        ((1, 2, 3), "= 1.2.3", True),
        ((1, 2, 4), "<= 1.2.3", False),
        ((1, 0, 0), "", None),
        ((1, 0, 0), "all versions", None),
    ],
)
def test_in_range(version, text, expected):
    assert in_range(version, text) is expected


def test_version_key_reads_prefixed_and_namespaced_tags():
    assert version_key("twenty/v2.45.0") == (2, 45, 0)
    assert version_key("v26.10.0-rc.1") == (26, 10, 0)


def advisory(*ranges):
    return {"vulnerabilities": [{"vulnerable_version_range": text} for text in ranges]}


def test_an_advisory_affects_a_version_when_any_vulnerability_range_matches():
    assert affects((2, 0, 0), advisory("< 1.0.0", "< 3.0.0")) is True


def test_an_advisory_does_not_affect_a_version_outside_every_range():
    assert affects((5, 0, 0), advisory("< 1.0.0", "< 3.0.0")) is False


def test_unknown_when_the_version_or_ranges_cannot_be_read():
    assert affects(None, advisory("< 1.0.0")) is None
    assert affects((1, 0, 0), advisory("garbage")) is None
    assert affects((1, 0, 0), {"vulnerabilities": []}) is None


def patched(range_text, fixes):
    return {"vulnerabilities": [{"vulnerable_version_range": range_text, "patched_versions": fixes}]}


def test_an_open_ended_range_is_not_vulnerable_once_a_fix_on_the_same_major_line_is_included():
    assert affects((7, 2, 0), patched(">= 7.0.0", "7.1.2")) is False
    assert affects((7, 1, 1), patched(">= 7.0.0", "7.1.2")) is True


def test_a_fix_on_another_major_line_does_not_cover_the_version():
    assert affects((7, 0, 1), patched(">= 7.0.0", "6.0.9, 5.2.11")) is True
    assert affects((7, 2, 0), patched(">= 4.0", "6.0.7, 5.2.9, 4.4.18")) is False
    assert affects((5, 2, 3), patched(">= 2.0.0", "5.2.11, 4.4.20")) is True
    assert affects((5, 2, 11), patched(">= 2.0.0", "5.2.11, 4.4.20")) is False

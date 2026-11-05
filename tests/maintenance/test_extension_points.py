"""Extension points per named release: filters, events and frontend plugin slots."""
from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

from collectors import extension_points, github
from dashboard.lib.config import get_config
from scripts import collect_maintenance
from scripts.collect_maintenance import ReleaseTag

FILTERS_PY = '''
class CourseEnrollmentStarted(OpenEdxPublicFilter):
    filter_type = "org.openedx.learning.course.enrollment.started.v1"

class Base:
    filter_type = ""
'''
SIGNALS_PY = '''
COURSE_ENROLLMENT_CREATED = OpenEdxPublicSignal(
    event_type="org.openedx.learning.course.enrollment.created.v1",
)
STUDENT_REGISTRATION_COMPLETED = OpenEdxPublicSignal(event_type="org.openedx.learning.student.registration.completed.v1")
'''


@pytest.fixture(scope="module")
def config() -> dict:
    return get_config("extension_points", "openedx")


def test_declarations_counted_by_the_configured_forms(config):
    packages = config["packages"]
    assert extension_points.declaration_count([FILTERS_PY], packages["filters"]["declaration"]) == 1
    assert extension_points.declaration_count([SIGNALS_PY, SIGNALS_PY], packages["events"]["declaration"]) == 4


def test_package_files_match_both_layouts(config):
    paths = [
        "openedx_filters/filters.py",
        "openedx_filters/learning/filters.py",
        "src/openedx_filters/authentication/filters.py",
        "tests/test_filters.py",
        "openedx_filters/learning/types.py",
    ]
    assert extension_points.matching_paths(paths, config["packages"]["filters"]["files"]) == [
        "openedx_filters/filters.py",
        "openedx_filters/learning/filters.py",
        "src/openedx_filters/authentication/filters.py",
    ]


def test_slots_are_folders_under_either_root(config):
    paths = [
        "src/plugin-slots/HeaderSlot/index.jsx",
        "src/plugin-slots/HeaderSlot/README.md",
        "src/plugin-slots/README.md",
        "src/slots/CourseBannerSlot/images/shot.png",
        "src/slots/README.md",
        "src/slots.tsx",
        "src/plugin-slots-extra/X/a.js",
    ]
    assert extension_points.slot_names(paths, config["frontend"]["slots_roots"]) == {"HeaderSlot", "CourseBannerSlot"}


def test_slots_record_drops_repos_without_slots():
    assert extension_points.slots_record({"b": 2, "a": 0, "c": 3}) == {"total": 5, "repos": {"b": 2, "c": 3}}


def _row(release: str, filters: int | None, events: int | None, slots: int) -> dict:
    return {
        "release": release,
        "filters": extension_points.package_record("1", filters),
        "events": extension_points.package_record("1", events),
        "plugin_slots": {"total": slots, "repos": {}},
    }


def test_summary_starts_each_count_at_the_first_release_that_has_it():
    rows = [_row("maple", None, 9, 0), _row("nutmeg", 9, 11, 0), _row("redwood", 19, 50, 10), _row("current", 43, 75, 84)]
    assert extension_points.summary(rows) == {
        "filters": {"first": {"release": "nutmeg", "count": 9}, "now": 43},
        "events": {"first": {"release": "maple", "count": 9}, "now": 75},
        "plugin_slots": {"first": {"release": "redwood", "count": 10}, "now": 84},
    }


def test_only_named_rows_from_the_same_code_and_settings_are_reused(config):
    published = {"collector_version": extension_points.VERSION, "settings": config}
    assert extension_points.is_reusable({"release": "ulmo"}, published, config)
    assert not extension_points.is_reusable({"release": "current"}, published, config)
    assert not extension_points.is_reusable({"release": "ulmo"}, {**published, "collector_version": 0}, config)
    assert not extension_points.is_reusable({"release": "ulmo"}, {**published, "settings": {}}, config)


class FakeGitHub:
    """Two releases of a platform, its pinned packages and two frontend apps, one archived."""

    def __init__(self):
        self.tree_calls: list[tuple[str, str]] = []
        self.trees = {
            ("openedx/openedx-filters", "v1.0.0"): ["openedx_filters/learning/filters.py"],
            ("openedx/openedx-events", "v2.0.0"): ["openedx_events/learning/signals.py"],
            ("openedx/openedx-events", "v3.0.0"): ["src/openedx_events/learning/signals.py"],
            ("openedx/frontend-app-learning", "open-release/sumac.1"): ["src/plugin-slots/A/index.jsx"],
            ("openedx/frontend-app-old", "open-release/sumac.1"): ["src/plugin-slots/B/index.jsx"],
            ("openedx/frontend-app-learning", "master"): ["src/plugin-slots/A/index.jsx", "src/slots/C/README.md"],
        }
        self.texts = {
            ("openedx/openedx-platform", "open-release/sumac.1", "requirements/edx/base.txt"): "openedx-events==2.0.0\n",
            ("openedx/openedx-platform", "master", "requirements/edx/base.txt"): "openedx-filters==1.0.0\nopenedx-events==3.0.0\n",
            ("openedx/openedx-filters", "v1.0.0", "openedx_filters/learning/filters.py"): FILTERS_PY,
            ("openedx/openedx-events", "v2.0.0", "openedx_events/learning/signals.py"): SIGNALS_PY,
            ("openedx/openedx-events", "v3.0.0", "src/openedx_events/learning/signals.py"): SIGNALS_PY * 2,
        }

    def blob_paths(self, repo, ref):
        self.tree_calls.append((repo, ref))
        return self.trees.get((repo, ref))

    def raw_text(self, repo, ref, path):
        return self.texts.get((repo, ref, path))

    def org_repos(self, org, *, include_archived=False):
        repos = [
            {"name": "frontend-app-learning", "full_name": "openedx/frontend-app-learning", "default_branch": "master"},
            {"name": "frontend-app-old", "full_name": "openedx/frontend-app-old", "default_branch": "master", "archived": True},
            {"name": "frontend-component-header", "full_name": "openedx/frontend-component-header", "default_branch": "master"},
            {"name": "edx-platform-docs", "full_name": "openedx/edx-platform-docs", "default_branch": "master"},
        ]
        return [repo for repo in repos if include_archived or not repo.get("archived")]


@pytest.fixture
def fake(monkeypatch, config):
    fake = FakeGitHub()
    for name in ("blob_paths", "raw_text", "org_repos"):
        monkeypatch.setattr(github, name, getattr(fake, name))
    releases = {
        "maple": ReleaseTag("open-release/maple.1", datetime(2021, 12, 16, tzinfo=timezone.utc)),
        "sumac": ReleaseTag("open-release/sumac.1", datetime(2024, 12, 13, tzinfo=timezone.utc)),
    }
    monkeypatch.setattr(collect_maintenance, "release_tags", lambda repo, prefixes: releases)
    monkeypatch.setattr(collect_maintenance, "get_config", lambda section, org: {**config, "releases": {**config["releases"], "first": "sumac"}})
    monkeypatch.setattr(collect_maintenance, "now_utc", lambda: datetime(2026, 11, 5, tzinfo=timezone.utc))
    return fake


def _collect(tmp_path) -> dict:
    target = collect_maintenance.Target("openedx", "openedx")
    assert collect_maintenance.collect_extension_points(tmp_path, scope=None, target=target) == 0
    return json.loads((tmp_path / collect_maintenance.EXTENSION_POINTS_FILE).read_text(encoding="utf-8"))


def test_collector_counts_each_release_from_its_pins_and_tags(tmp_path, fake):
    published = _collect(tmp_path)

    rows = {row["release"]: row for row in published["records"]}
    assert list(rows) == ["sumac", "current"]
    assert rows["sumac"]["filters"] == {"version": None, "count": None}
    assert rows["sumac"]["events"] == {"version": "2.0.0", "count": 2}
    assert rows["sumac"]["plugin_slots"] == {"total": 2, "repos": {"openedx/frontend-app-learning": 1, "openedx/frontend-app-old": 1}}
    assert rows["current"]["filters"] == {"version": "1.0.0", "count": 1}
    assert rows["current"]["events"] == {"version": "3.0.0", "count": 4}
    assert rows["current"]["plugin_slots"] == {"total": 2, "repos": {"openedx/frontend-app-learning": 2}}
    assert not any("frontend-component" in repo for repo, _ in fake.tree_calls)


def test_collector_reads_only_the_current_row_again(tmp_path, fake):
    _collect(tmp_path)
    fake.tree_calls.clear()

    _collect(tmp_path)

    assert {ref for _, ref in fake.tree_calls} == {"master", "v1.0.0", "v3.0.0"}


def test_collector_failure_keeps_the_published_file(tmp_path, fake, monkeypatch, capsys):
    _collect(tmp_path)
    before = (tmp_path / collect_maintenance.EXTENSION_POINTS_FILE).read_text(encoding="utf-8")

    def fail(*args, **kwargs):
        raise RuntimeError("gh api https://api.github.com/x failed: HTTP 502")

    monkeypatch.setattr(github, "org_repos", fail)

    assert collect_maintenance.collect_extension_points(tmp_path, scope=None, target=collect_maintenance.Target("openedx", "openedx")) == 0
    assert "kept the published file" in capsys.readouterr().out
    assert (tmp_path / collect_maintenance.EXTENSION_POINTS_FILE).read_text(encoding="utf-8") == before

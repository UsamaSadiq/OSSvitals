"""Modularization facts parsed from monolith source files and trees."""
from __future__ import annotations

import pytest

from collectors import modularization
from dashboard.lib.config import get_config

COMMON_PY = """
USE_EXTRACTED_WORD_CLOUD_BLOCK = True
USE_EXTRACTED_VIDEO_BLOCK = False
    USE_EXTRACTED_INDENTED_BLOCK = True
# USE_EXTRACTED_COMMENTED_BLOCK = True
"""

BASE_TXT = """
openedx-core==1.21.0
    # via -r requirements/edx/kernel.in
xblocks-contrib==1.0.8 ; python_version >= "3.12"
OpenEdx-Filters==3.16.0
"""


@pytest.fixture(scope="module")
def config() -> dict:
    return get_config("modularization", "openedx")


def test_extracted_blocks_reads_top_level_toggles_only(config):
    blocks = modularization.extracted_blocks(COMMON_PY, config["extracted_blocks"]["pattern"])

    assert blocks == [
        {"block": "Video", "toggle": "VIDEO", "status": modularization.BUILT_IN},
        {"block": "Word Cloud", "toggle": "WORD_CLOUD", "status": modularization.EXTRACTED},
    ]


def test_extracted_blocks_of_missing_file_is_empty(config):
    assert modularization.extracted_blocks(None, config["extracted_blocks"]["pattern"]) == []


def test_legacy_frontend_counts_only_matching_roots_and_extensions(config):
    rules = config["legacy_frontend"]
    paths = [
        "lms/static/js/app.js",
        "cms/templates/base.html",
        "common/static/sass/_base.scss",
        "lms/static/js/spec/app_spec.js",
        "lms/djangoapps/x/tests/page.html",
        "common/test/data/fixtures/a.html",
        "lms/djangoapps/x/views.py",
        "webpack.config.js",
        "Makefile",
    ]

    assert modularization.legacy_frontend_count(paths, rules) == 3


def test_pinned_versions_matches_names_case_insensitively():
    pins = modularization.pinned_versions(BASE_TXT, ["openedx-core", "xblocks-contrib", "openedx-filters", "openedx-events"])

    assert pins == {
        "openedx-core": "1.21.0",
        "xblocks-contrib": "1.0.8",
        "openedx-filters": "3.16.0",
        "openedx-events": None,
    }


def test_summary_reports_share_extracted():
    blocks = [{"status": modularization.EXTRACTED}] * 3 + [{"status": modularization.BUILT_IN}]

    assert modularization.summary(blocks) == {"blocks": 4, "extracted": 3, "percent_extracted": 75}
    assert modularization.summary([])["percent_extracted"] == 0


def test_block_label_keeps_configured_acronyms():
    assert modularization.block_label("HTML", ["HTML", "LTI"]) == "HTML"
    assert modularization.block_label("POLL_QUESTION", ["HTML"]) == "Poll Question"

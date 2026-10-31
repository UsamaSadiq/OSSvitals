import json
from datetime import timedelta

import scripts.collect_fleet as collect_fleet
from collectors.fleet.feeds import KEV_CACHE, compact_kev
from collectors.fleet.settings import load_settings
from dashboard.lib.clock import now_utc

RAW = {"catalogVersion": "v", "vulnerabilities": [{"cveID": "CVE-1", "dateAdded": "2026-10-02"}]}


def test_the_cached_catalog_round_trips_through_the_published_feeds_folder(tmp_path, monkeypatch):
    cache_dir = tmp_path / "previous-feeds"
    cache_dir.mkdir()
    cached = compact_kev(RAW, now_utc() - timedelta(days=1))
    (cache_dir / KEV_CACHE).write_text(json.dumps(cached))
    monkeypatch.setattr(collect_fleet.kev, "catalogue", lambda: None)
    feeds = collect_fleet._feeds(load_settings("moneta"), cache_dir)
    assert feeds.kev().from_cache is True
    out_dir = tmp_path / "out"
    collect_fleet._publish_feeds(feeds, out_dir)
    assert json.loads((out_dir / "feeds" / KEV_CACHE).read_text()) == cached


def test_tenants_without_a_feed_signal_never_build_feeds(tmp_path):
    from collectors.fleet.settings import DEFAULTS_PATH, build_settings
    from dashboard.lib.config import read_config_file

    assert collect_fleet._feeds(build_settings("demo", read_config_file(DEFAULTS_PATH), {}), tmp_path) is None


def test_an_unreadable_cache_file_is_treated_as_no_cache(tmp_path):
    (tmp_path / KEV_CACHE).write_text("{not json")
    assert collect_fleet._read_json(tmp_path / KEV_CACHE) is None

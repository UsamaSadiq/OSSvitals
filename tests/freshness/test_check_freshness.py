"""The freshness script finds tenants on the data branch without being told about them."""
from __future__ import annotations

import json
from datetime import date

from scripts import check_freshness

TODAY = date(2026, 10, 12)


def _write_meta(data_dir, org, generated_at, stale_hours=None):
    folder = data_dir / org / "views"
    folder.mkdir(parents=True)
    meta = {"metadata": {"generated_at": generated_at}}
    if stale_hours is not None:
        meta["stale_threshold_hours"] = stale_hours
    (folder / "meta.json").write_text(json.dumps(meta), encoding="utf-8")


def test_every_org_with_a_meta_file_is_checked(tmp_path):
    _write_meta(tmp_path, "openedx", "2026-10-12T00:00:00+00:00")
    _write_meta(tmp_path, "moneta", "2026-10-12T00:00:00+00:00")
    (tmp_path / "notes").mkdir()
    assert check_freshness._orgs(tmp_path) == ["moneta", "openedx"]


def test_each_tenant_uses_its_own_limit(tmp_path):
    _write_meta(tmp_path, "slow", "2026-10-08T00:00:00+00:00", stale_hours=168)
    _write_meta(tmp_path, "fast", "2026-10-08T00:00:00+00:00", stale_hours=24)
    assert not check_freshness._meta_status(tmp_path, "slow", TODAY).stale
    assert check_freshness._meta_status(tmp_path, "fast", TODAY).stale


def test_unreadable_meta_is_stale(tmp_path):
    folder = tmp_path / "broken" / "views"
    folder.mkdir(parents=True)
    (folder / "meta.json").write_text("{not json", encoding="utf-8")
    result = check_freshness._meta_status(tmp_path, "broken", TODAY)
    assert result.stale and result.detail == "JSONDecodeError"


def test_a_tenant_without_a_csv_has_no_upstream_checks():
    assert check_freshness._upstream_statuses("tenant-without-config", TODAY) == []

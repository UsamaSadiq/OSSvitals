#!/usr/bin/env python3
"""Collect a fleet tenant's fork status from the public GitHub API.

``--tier api`` (daily) writes views/{meta,apps,drift,drift_history,updates}.json, badges/ and VERSIONS.md.
``--tier clone`` (weekly) writes views/<signal>.json for each clone signal the tenant enabled.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable

from collectors import github, kev, publish
from collectors.fleet import badges, history, inventory, meta, versions
from collectors.fleet.collect import collect_clone_signals, collect_fork
from collectors.fleet.feeds import KEV_CACHE, Feeds
from collectors.fleet.settings import FleetSettings, load_settings
from collectors.fleet.signals import API, CLONE
from dashboard.lib.clock import now_utc
from dashboard.lib.config import get_config

WORKERS = 4
HISTORY_FILE = "drift_history.json"
DRIFT_FILE = "drift.json"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--org", required=True, help="Config folder under dashboard/config.")
    parser.add_argument("--out-dir", type=Path, required=True, help="Org folder to write: views/, badges/ and VERSIONS.md.")
    parser.add_argument("--tier", choices=[API, CLONE], default=API)
    parser.add_argument("--repo", action="append", default=[], help="Limit to these repos; default is every app.")
    parser.add_argument("--previous-dir", type=Path, help="Views published by the last run; its drift history is extended.")
    parser.add_argument("--feed-cache-dir", type=Path, help="Feed copies published by the last run (<org>/feeds), used when a feed is down.")
    return parser.parse_args()


def _isolated(repo: str, collect: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    try:
        return collect()
    except (RuntimeError, LookupError, KeyError, ValueError, re.error) as error:
        print(f"{repo}: {error}", file=sys.stderr)
        return {"repo": repo, "error": str(error)}


def _apps(org: str, repos: list[str]) -> tuple[str, list[dict[str, Any]]]:
    config = get_config("apps", org)
    return config["github_org"], [app for app in config["apps"] if not repos or app["repo"] in repos]


def collect(
    settings: FleetSettings, repos: list[str], previous: dict[str, dict[str, Any]] | None = None, feeds: Feeds | None = None
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    github_org, apps = _apps(settings.org, repos)
    previous = previous or {}
    now = now_utc()
    api = github.api_optional

    def one(app: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any] | None]:
        record = _isolated(app["repo"], lambda: inventory.collect_app(api, github_org, app, settings.production, github.file_content))
        if app["class"] != "fork":
            return record, None
        drift = _isolated(app["repo"], lambda: collect_fork(api, github_org, app, settings, now, github.merged_by_logins, previous.get(app["repo"]), feeds))
        return record, drift

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(one, apps))
    return [record for record, _ in results], [drift for _, drift in results if drift is not None]


def _previous_records(previous_dir: Path | None, name: str) -> list[dict[str, Any]]:
    path = previous_dir / name if previous_dir else None
    if not path or not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get("records", [])


def _previous_drift(previous_dir: Path | None) -> dict[str, dict[str, Any]]:
    return {record["repo"]: record for record in _previous_records(previous_dir, DRIFT_FILE) if "error" not in record}


def _read_json(path: Path | None) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path and path.exists() else None
    except ValueError:
        return None


def _feeds(settings: FleetSettings, cache_dir: Path | None) -> Feeds | None:
    """Only built when a feed signal is collected, so other tenants never download a feed."""
    if not settings.collects("exploitability"):
        return None
    cached = _read_json(cache_dir / KEV_CACHE if cache_dir else None)
    return Feeds(kev.catalogue, cached, now_utc(), settings.signal("exploitability")["max_age_days"])


def _publish_feeds(feeds: Feeds | None, out_dir: Path) -> None:
    copy = feeds.kev_cache_to_publish() if feeds else None
    if copy:
        publish.write(out_dir / "feeds" / KEV_CACHE, copy)


def _updates(org: str) -> list[dict[str, Any]]:
    updates = get_config("updates", org).get("updates", [])
    return sorted(updates, key=lambda update: update["date"], reverse=True)


def run_api_tier(settings: FleetSettings, args: argparse.Namespace) -> int:
    generated_at = now_utc()
    previous_history = _previous_records(args.previous_dir, HISTORY_FILE)
    repos = [app["repo"] for app in _apps(settings.org, args.repo)[1]]
    previous = history.with_last_licence(_previous_drift(args.previous_dir), previous_history, repos)
    feeds = _feeds(settings, args.feed_cache_dir)
    records, drift = collect(settings, args.repo, previous, feeds)
    healthy = [record for record in records if "error" not in record]
    if not healthy:
        print("No app could be collected; not writing.")
        return 1
    org = settings.org
    day = generated_at.date().isoformat()
    branding = get_config("org_branding", org)
    github_org = get_config("apps", org)["github_org"]
    views = {
        "meta": meta.meta_view(org, generated_at, branding=branding, settings=settings, github_org=github_org),
        "apps": meta.records_view(org, generated_at, records),
        "drift": meta.records_view(org, generated_at, drift),
        "drift_history": meta.records_view(
            org,
            generated_at,
            history.append(previous_history, drift, day, settings.values["history_days"]),
        ),
        "updates": meta.records_view(org, generated_at, _updates(org)),
    }
    for name, content in views.items():
        publish.write(args.out_dir / "views" / f"{name}.json", content)
    for record in (record for record in drift if "error" not in record):
        publish.write(args.out_dir / "badges" / f"{record['repo']}.json", badges.badge(record, settings.statuses))
    (args.out_dir / "VERSIONS.md").write_text(versions.render(records, drift, day), encoding="utf-8")
    _publish_feeds(feeds, args.out_dir)
    print(f"{org}: {len(healthy)}/{len(records)} apps, {len(drift)} forks")
    return 0


def clone_signal_records(settings: FleetSettings, keys: list[str], repos: list[str]) -> dict[str, list[dict[str, Any]]]:
    """Each fork is cloned once and every weekly signal reads that clone."""
    github_org, apps = _apps(settings.org, repos)
    now = now_utc()
    by_fork = [collect_clone_signals(keys, github.api_optional, github_org, app, settings, now) for app in apps if app["class"] == "fork"]
    return {key: [records[key] for records in by_fork] for key in keys}


def run_clone_tier(settings: FleetSettings, args: argparse.Namespace) -> int:
    """A signal whose every fork failed is not written, so its last good view stays published; the others still are."""
    failed = []
    keys = settings.enabled_signals(CLONE)
    by_key = clone_signal_records(settings, keys, args.repo) if keys else {}
    for key in keys:
        records = by_key[key]
        if not any("error" not in record for record in records):
            print(f"{key}: no fork could be collected; not writing.")
            failed.append(key)
            continue
        publish.write(args.out_dir / "views" / f"{key}.json", meta.records_view(settings.org, now_utc(), records))
        print(f"{key}: {len(records)} forks")
    return 1 if failed else 0


def main() -> int:
    args = _parse_args()
    settings = load_settings(args.org)
    return run_api_tier(settings, args) if args.tier == API else run_clone_tier(settings, args)


if __name__ == "__main__":
    sys.exit(main())

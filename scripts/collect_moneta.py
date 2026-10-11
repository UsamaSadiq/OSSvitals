#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable

from collectors import github, publish
from collectors.moneta import fork, inventory, meta
from dashboard.lib.clock import now_utc
from dashboard.lib.config import get_config

ORG = "moneta"
WORKERS = 4


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect Moneta fork status from the public GitHub API.")
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--org", default=ORG, help="Config folder under dashboard/config.")
    parser.add_argument("--repo", action="append", default=[], help="Limit to these repos; default is every app.")
    return parser.parse_args()


def _isolated(repo: str, collect: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    try:
        return collect()
    except (RuntimeError, LookupError, KeyError, ValueError) as error:
        print(f"{repo}: {error}", file=sys.stderr)
        return {"repo": repo, "error": str(error)}


def collect(org: str, repos: list[str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    config = get_config("apps", org)
    rules = get_config("status", org)
    now = now_utc()
    apps = [app for app in config["apps"] if not repos or app["repo"] in repos]
    github_org = config["github_org"]

    def one(app: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any] | None]:
        record = _isolated(app["repo"], lambda: inventory.collect_app(github.api_optional, github_org, app))
        if app["class"] != "fork":
            return record, None
        drift = _isolated(app["repo"], lambda: fork.collect_fork(github.api_optional, github_org, app, rules, now))
        return record, drift

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(one, apps))
    return [record for record, _ in results], [drift for _, drift in results if drift is not None]


def main() -> int:
    args = _parse_args()
    generated_at = now_utc()
    records, drift = collect(args.org, args.repo)
    healthy = [record for record in records if "error" not in record]
    if not healthy:
        print("No app could be collected; not writing.")
        return 1
    config = get_config("apps", args.org)
    rules = get_config("status", args.org)
    views = {
        "meta": meta.meta_view(args.org, generated_at, branding=get_config("org_branding", args.org), rules=rules, github_org=config["github_org"]),
        "apps": meta.records_view(args.org, generated_at, records),
        "drift": meta.records_view(args.org, generated_at, drift),
    }
    for name, content in views.items():
        publish.write(args.out_dir / f"{name}.json", content)
    print(f"Moneta: {len(healthy)}/{len(records)} apps, {len(drift)} forks")
    return 0


if __name__ == "__main__":
    sys.exit(main())

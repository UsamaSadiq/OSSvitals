#!/usr/bin/env python3
"""Forecast the merge conflicts of syncing each fork with its upstream (git merge-tree, no worktree)."""
from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path
from typing import Any

from collectors import github, publish
from collectors.moneta import conflicts, fork, meta
from dashboard.lib.clock import now_utc
from dashboard.lib.config import get_config

ORG = "moneta"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, required=True, help="Org folder; writes views/conflicts.json.")
    parser.add_argument("--org", default=ORG)
    parser.add_argument("--repo", action="append", default=[])
    return parser.parse_args()


def _release_tag(app: dict[str, Any]) -> str | None:
    releases = fork.upstream_releases(github.api_optional, app["upstream"])
    release = fork.latest_upstream_release(github.api_optional, app["upstream"], releases)
    return release["tag"] if release else None


def forecast_fork(github_org: str, app: dict[str, Any], production_default: str) -> dict[str, Any]:
    production = app.get("production_branch", production_default)
    tag = _release_tag(app)
    with tempfile.TemporaryDirectory() as tmp:
        directory = Path(tmp) / "clone.git"
        conflicts.prepare_clone(
            directory,
            f"https://github.com/{github_org}/{app['repo']}.git",
            production,
            f"https://github.com/{app['upstream']}.git",
            app["upstream_branch"],
            tag,
        )
        return {"repo": app["repo"], **conflicts.collect_forecast(directory, production, tag)}


def main() -> int:
    args = _parse_args()
    config = get_config("apps", args.org)
    production = get_config("status", args.org)["branches"]["production"]
    records = []
    for app in config["apps"]:
        if app["class"] != "fork" or (args.repo and app["repo"] not in args.repo):
            continue
        try:
            records.append(forecast_fork(config["github_org"], app, production))
        except (RuntimeError, KeyError) as error:
            print(f"{app['repo']}: {error}", file=sys.stderr)
            records.append({"repo": app["repo"], "error": str(error)})
    if not any("error" not in record for record in records):
        print("No fork could be forecast; not writing.")
        return 1
    publish.write(args.out_dir / "views" / "conflicts.json", meta.records_view(args.org, now_utc(), records))
    print(f"Conflict forecast: {len(records)} forks")
    return 0


if __name__ == "__main__":
    sys.exit(main())

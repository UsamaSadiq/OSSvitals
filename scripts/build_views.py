#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dashboard.lib.clock import now_utc
from dashboard.lib.config import DEFAULT_ORG, get_config
from dashboard.lib.pipeline import score_org
from dashboard.lib.views_export import BuildContext, write_views
from dashboard.lib.views_maintenance import load_maintenance_dir


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Write page-ready JSON files for the static frontend.")
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--org", default=DEFAULT_ORG)
    parser.add_argument(
        "--maintenance-dir",
        type=Path,
        help="Directory holding the collect-maintenance files; Components and Upgrades are empty without it.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    data = score_org(args.org)
    if data.scored.empty:
        print("Snapshot is empty; not writing.")
        return 1
    waves = get_config("waves", args.org).get("waves", {})
    ctx = BuildContext(
        data=data,
        generated_at=now_utc(),
        commit_sha=os.environ.get("GITHUB_SHA", "local"),
        maintenance=load_maintenance_dir(args.maintenance_dir, waves),
    )
    written = write_views(ctx, args.out_dir)
    print(f"Wrote {len(written)} view files for {args.org} to {args.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

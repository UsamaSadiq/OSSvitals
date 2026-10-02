#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dashboard.lib.clock import now_utc
from dashboard.lib.config import DEFAULT_ORG
from dashboard.lib.pipeline import score_org
from dashboard.lib.views_export import BuildContext, write_views


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Write page-ready JSON files for the static frontend.")
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--org", default=DEFAULT_ORG)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    data = score_org(args.org)
    if data.scored.empty:
        print("Snapshot is empty; not writing.")
        return 1
    written = write_views(BuildContext(data=data, generated_at=now_utc()), args.out_dir)
    print(f"Wrote {len(written)} view files for {args.org} to {args.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

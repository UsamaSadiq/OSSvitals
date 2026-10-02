#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dashboard.lib.clock import now_utc
from dashboard.lib.config import DEFAULT_ORG, get_config
from dashboard.lib.pipeline import score_org
from dashboard.lib.scores_export import build_history_payload, build_snapshot_payload, dumps

SNAPSHOT_FILENAME = "scores.json"
HISTORY_FILENAME = "scores_history.json"
PROPOSED_FILENAME = "scores_proposed.json"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Write pre-computed score files.")
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--org", default=DEFAULT_ORG)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    min_rows = int(get_config("data_source", args.org).get("expected_min_rows", 1))

    data = score_org(args.org)
    if len(data.scored) < min_rows:
        print(f"Snapshot has {len(data.scored)} rows, expected at least {min_rows}; not writing.")
        return 1
    if not data.history:
        print("History is empty; not writing.")
        return 1

    generated_at = now_utc()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    snapshot_payload = build_snapshot_payload(data.scored, generated_at=generated_at, source_url=data.snapshot_url)
    (args.out_dir / SNAPSHOT_FILENAME).write_text(dumps(snapshot_payload), encoding="utf-8")

    proposed_payload = build_snapshot_payload(data.proposed, generated_at=generated_at, source_url=data.snapshot_url)
    (args.out_dir / PROPOSED_FILENAME).write_text(dumps(proposed_payload), encoding="utf-8")

    history_payload = build_history_payload(data.history, generated_at=generated_at, source_url=data.history_url)
    (args.out_dir / HISTORY_FILENAME).write_text(dumps(history_payload), encoding="utf-8")

    print(
        f"Wrote {len(snapshot_payload['records'])} repos and "
        f"{len(history_payload['snapshots'])} history snapshots to {args.out_dir}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

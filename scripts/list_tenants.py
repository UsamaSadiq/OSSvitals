#!/usr/bin/env python3
"""Print the orgs of one tenant kind as a JSON array, for a workflow matrix."""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from dashboard.lib.config import CONFIG_DIR, read_config_file
from dashboard.lib.schema import validate_config_data

INDEX_PATH = CONFIG_DIR / "tenants.json"


def load_index() -> dict[str, Any]:
    index = read_config_file(INDEX_PATH)
    validate_config_data("tenants", index, strict=True)
    return index


def orgs_of_kind(index: dict[str, Any], kind: str) -> list[str]:
    return sorted(org for org, tenant in index.items() if tenant["kind"] == kind)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kind", required=True, choices=["health", "fleet"])
    args = parser.parse_args()
    print(json.dumps(orgs_of_kind(load_index(), args.kind)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

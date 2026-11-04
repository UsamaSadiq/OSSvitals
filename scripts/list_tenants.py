#!/usr/bin/env python3
"""Print tenant orgs as a JSON array, for a workflow matrix: one kind's public tenants, or every private tenant."""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from dashboard.lib.config import CONFIG_DIR, read_config_file
from dashboard.lib.schema import validate_config_data

INDEX_PATH = CONFIG_DIR / "tenants.json"
PUBLIC = "public"
PRIVATE = "private"


def load_index() -> dict[str, Any]:
    index = read_config_file(INDEX_PATH)
    validate_config_data("tenants", index, strict=True)
    return index


def visibility_of(tenant: dict[str, Any]) -> str:
    return tenant.get("visibility", PUBLIC)


def is_private(tenant: dict[str, Any]) -> bool:
    return visibility_of(tenant) == PRIVATE


def orgs_with(index: dict[str, Any], *, kind: str | None = None, visibility: str = PUBLIC) -> list[str]:
    return sorted(
        org for org, tenant in index.items() if visibility_of(tenant) == visibility and (kind is None or tenant["kind"] == kind)
    )


def orgs_of_kind(index: dict[str, Any], kind: str) -> list[str]:
    """Public tenants only: the workflows of this repository never collect or publish a private one."""
    return orgs_with(index, kind=kind)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kind", choices=["health", "fleet"])
    parser.add_argument("--visibility", choices=[PUBLIC, PRIVATE], default=PUBLIC)
    args = parser.parse_args()
    print(json.dumps(orgs_with(load_index(), kind=args.kind, visibility=args.visibility)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

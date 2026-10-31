from __future__ import annotations

from typing import Any

HEADER = ["App", "Latest release", "Upstream release", "Licence", "Status"]
NOTE = (
    "Generated from public GitHub data. \"Latest release\" is the newest stable tag we cut from the production branch; "
    "it is what source is published, not what any server is running."
)


def _cell(value: str | None) -> str:
    return value or "–"


def render(apps: list[dict[str, Any]], drift: list[dict[str, Any]], generated_on: str) -> str:
    by_repo = {record["repo"]: record for record in drift if "error" not in record}
    rows = []
    for app in sorted((app for app in apps if "error" not in app), key=lambda app: app["repo"].lower()):
        record = by_repo.get(app["repo"])
        release = (record or {}).get("fork_release") or {}
        upstream = (record or {}).get("upstream_release") or {}
        rows.append(
            [
                app["repo"],
                _cell(release.get("tag") or app.get("latest_tag")),
                _cell(upstream.get("tag")),
                _cell(app.get("licence")),
                _cell(record["status"] if record else None),
            ]
        )
    lines = ["# Versions", "", f"Generated {generated_on}. {NOTE}", "", f"| {' | '.join(HEADER)} |", f"|{'---|' * len(HEADER)}"]
    lines += [f"| {' | '.join(row)} |" for row in rows]
    return "\n".join(lines) + "\n"

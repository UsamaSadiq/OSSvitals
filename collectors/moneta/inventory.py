from __future__ import annotations

from typing import Any

from collectors.moneta.fork import Api, stable_tags


def collect_app(api: Api, org: str, app: dict[str, Any]) -> dict[str, Any]:
    base = f"repos/{org}/{app['repo']}"
    repo = api(base)
    if repo is None:
        raise LookupError(f"{base} not found")
    tags = stable_tags(api(f"{base}/tags?per_page=100") or [])
    upstream = app.get("upstream")
    return {
        "repo": app["repo"],
        "class": app["class"],
        "url": repo["html_url"],
        "description": repo.get("description"),
        "licence": app.get("licence"),
        "upstream": upstream,
        "upstream_url": f"https://github.com/{upstream}" if upstream else None,
        "purpose": app.get("purpose"),
        "what_we_changed": app.get("what_we_changed"),
        "pushed_at": repo["pushed_at"],
        "open_issues_and_prs": repo["open_issues_count"],
        "latest_tag": tags[0]["name"] if tags else None,
    }

from __future__ import annotations

from typing import Any, Callable

from collectors.moneta.fork import Api, stable_tags

FORK_NOTES_PATH = "FORK.md"
NOTES_LIMIT = 1500


def _fork_notes(read_text: Callable[[str, str, str], str | None], full_name: str, production: str) -> str | None:
    text = read_text(full_name, FORK_NOTES_PATH, production)
    return text.strip()[:NOTES_LIMIT] if text and text.strip() else None


def collect_app(
    api: Api,
    org: str,
    app: dict[str, Any],
    production_default: str,
    read_text: Callable[[str, str, str], str | None] = lambda *_: None,
) -> dict[str, Any]:
    base = f"repos/{org}/{app['repo']}"
    repo = api(base)
    if repo is None:
        raise LookupError(f"{base} not found")
    tags = stable_tags(api(f"{base}/tags?per_page=100") or [])
    open_pulls = api(f"{base}/pulls?state=open&per_page=100") or []
    upstream = app.get("upstream")
    production = app.get("production_branch", production_default) if upstream else None
    notes = _fork_notes(read_text, f"{org}/{app['repo']}", production or repo["default_branch"])
    return {
        "repo": app["repo"],
        "class": app["class"],
        "url": repo["html_url"],
        "description": repo.get("description"),
        "licence": app.get("licence"),
        "licence_note": app.get("licence_note"),
        "upstream": upstream,
        "upstream_url": f"https://github.com/{upstream}" if upstream else None,
        "upstream_branch": app.get("upstream_branch"),
        "production_branch": production,
        "purpose": app.get("purpose"),
        "what_we_changed": notes or app.get("what_we_changed"),
        "mcp_server": app.get("mcp_server"),
        "sso": app.get("sso"),
        "e2e": app.get("e2e"),
        "runbook_url": app.get("runbook_url"),
        "pushed_at": repo["pushed_at"],
        "open_pull_requests": len(open_pulls),
        "latest_tag": tags[0]["name"] if tags else None,
    }

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BadgeTarget:
    repo_name: str
    badge_url: str
    markdown: str


def badge_url_for_repo(repo_name: str, badge_base_url: str) -> str:
    safe_repo = repo_name.replace("/", "__")
    return f"{badge_base_url.rstrip('/')}/{safe_repo}.svg"


def markdown_badge(repo_name: str, dashboard_url: str, badge_base_url: str) -> BadgeTarget:
    badge_url = badge_url_for_repo(repo_name, badge_base_url)
    markdown = f"[![Repo health]({badge_url})]({dashboard_url}?tab=detail&repo={repo_name})"
    return BadgeTarget(repo_name=repo_name, badge_url=badge_url, markdown=markdown)

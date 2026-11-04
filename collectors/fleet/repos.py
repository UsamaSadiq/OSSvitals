"""Where an app lives: its own ``owner`` when it sets one, otherwise the tenant's ``github_org``."""
from __future__ import annotations

from collections import Counter
from typing import Any


def owner_of(github_org: str, app: dict[str, Any]) -> str:
    return app.get("owner", github_org)


def full_name(github_org: str, app: dict[str, Any]) -> str:
    return f"{owner_of(github_org, app)}/{app['repo']}"


def duplicate_repos(apps: list[dict[str, Any]]) -> list[str]:
    """Views, badges and pages key every app by its repo name, so two apps may not share one across owners."""
    counts = Counter(app["repo"] for app in apps)
    return sorted(repo for repo, count in counts.items() if count > 1)

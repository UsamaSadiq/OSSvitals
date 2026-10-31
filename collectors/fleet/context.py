from __future__ import annotations

import re
from datetime import datetime
from functools import cached_property
from typing import TYPE_CHECKING, Any, Callable

from collectors.fleet import fork
from collectors.fleet.release_gap import release_gap

if TYPE_CHECKING:
    from collectors.fleet.feeds import Feeds
    from collectors.fleet.settings import FleetSettings

Api = Callable[[str], Any]
MergedBy = Callable[[str, str, str], list[str] | None]


class ForkContext:
    """What the signals of one fork share. Each part is fetched once, and only when a signal asks for it."""

    def __init__(
        self,
        api: Api,
        org: str,
        app: dict[str, Any],
        settings: FleetSettings,
        now: datetime,
        merged_by: MergedBy = lambda *_: None,
        previous: dict[str, Any] | None = None,
        feeds: Feeds | None = None,
    ) -> None:
        self.api = api
        self.org = org
        self.app = app
        self.settings = settings
        self.now = now
        self.merged_by = merged_by
        self.previous = previous
        self.feeds = feeds
        self.base = f"repos/{org}/{app['repo']}"
        self.upstream = app["upstream"]
        self.owner = self.upstream.split("/")[0]
        self.production = app.get("production_branch", settings.production)
        self.staging = None if "production_branch" in app else settings.staging
        self.upstream_ref = f"{self.owner}:{app['upstream_branch']}"
        self.fork_pattern = re.compile(app.get("fork_release_tag", settings.fork_release_tag))
        self.upstream_pattern = re.compile(app["release_tag"]) if "release_tag" in app else None

    @cached_property
    def comparison(self) -> dict[str, Any]:
        comparison = self.api(f"{self.base}/compare/{self.upstream_ref}...{self.production}")
        if comparison is None:
            raise LookupError(f"cannot compare {self.upstream_ref} with {self.production}")
        return comparison

    @cached_property
    def merged_at(self) -> str:
        return self.comparison["merge_base_commit"]["commit"]["committer"]["date"]

    @cached_property
    def tags(self) -> list[dict[str, Any]]:
        return self.api(f"{self.base}/tags?per_page=100") or []

    @cached_property
    def fork_release(self) -> dict[str, Any] | None:
        return fork.latest_fork_release(self.api, self.base, self.upstream_ref, self.tags, self.fork_pattern)

    @cached_property
    def upstream_releases(self) -> list[dict[str, Any]]:
        return fork.all_upstream_releases(self.api, self.upstream, self.upstream_pattern)

    @cached_property
    def upstream_release(self) -> dict[str, Any] | None:
        return fork.latest_upstream_release(self.api, self.upstream, self.upstream_releases, self.upstream_pattern)

    @cached_property
    def upstream_advisories(self) -> list[dict[str, Any]]:
        return self.api(f"repos/{self.upstream}/security-advisories?per_page=100") or []

    @cached_property
    def base_ref(self) -> str:
        """Our latest release, or the production branch before the first one."""
        return self.fork_release["tag"] if self.fork_release else self.production

    @cached_property
    def base_release(self) -> str | None:
        return fork.fork_base_release(self.api, self.base, self.upstream, self.base_ref, self.upstream_releases, self.merged_at)

    @cached_property
    def release_gap(self) -> dict[str, Any] | None:
        return release_gap(self.base_release, self.base_ref, self.upstream_releases, self.now)

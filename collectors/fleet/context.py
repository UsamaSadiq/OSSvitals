from __future__ import annotations

import re
from datetime import datetime
from functools import cached_property
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable

from collectors.fleet import conflicts, fork
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
        workspace: Path | None = None,
    ) -> None:
        self.api = api
        self.org = org
        self.app = app
        self.settings = settings
        self.now = now
        self.merged_by = merged_by
        self.previous = previous
        self.feeds = feeds
        self.workspace = workspace
        self._clone: Path | Exception | None = None
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

    @property
    def fork_url(self) -> str:
        return f"https://github.com/{self.org}/{self.app['repo']}.git"

    @property
    def upstream_url(self) -> str:
        return f"https://github.com/{self.upstream}.git"

    @cached_property
    def clone_release_lookup(self) -> tuple[str | None, Exception | None]:
        """Upstream's newest release on the first releases page, as the weekly conflict forecast has always used.

        A failed lookup is kept, not raised: only the forecast needs the release, the clone and other signals do not.
        """
        try:
            releases = fork.upstream_releases(self.api, self.upstream)
            release = fork.latest_upstream_release(self.api, self.upstream, releases)
        except RuntimeError as error:
            return None, error
        return (release["tag"] if release else None), None

    @property
    def clone_release_tag(self) -> str | None:
        tag, error = self.clone_release_lookup
        if error:
            raise error
        return tag

    @property
    def clone(self) -> Path:
        """One blob-less clone holding our production branch and upstream's head and release, shared by the weekly
        signals of this fork; a failed clone fails each of them the same way instead of being retried."""
        if self._clone is None:
            self._clone = self._prepare_clone()
        if isinstance(self._clone, Exception):
            raise self._clone
        return self._clone

    def _prepare_clone(self) -> Path | Exception:
        if self.workspace is None:
            return RuntimeError("no clone workspace for this run")
        directory = self.workspace / "clone.git"
        try:
            conflicts.prepare_clone(directory, self.fork_url, self.production, self.upstream_url, self.app["upstream_branch"], self.clone_release_lookup[0])
        except RuntimeError as error:
            return error
        return directory

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
    def production_base_release(self) -> str | None:
        """The upstream release in the history of the production branch, which can be newer than ``base_release``
        (computed from our latest release) when upstream was merged after our last release."""
        if self.base_ref == self.production:
            return self.base_release
        return fork.fork_base_release(self.api, self.base, self.upstream, self.production, self.upstream_releases, self.merged_at)

    @cached_property
    def release_gap(self) -> dict[str, Any] | None:
        return release_gap(self.base_release, self.base_ref, self.upstream_releases, self.now)

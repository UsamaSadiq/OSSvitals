"""Per-repo progress on package upgrade campaigns (``campaigns.yaml``).

A campaign raises one package to a minimum version across the org, for example
certifi after a CA removal (public-engineering#574). The pins come from each
repo's committed lock files, so a repo counts as done only once the upgrade has
merged, whichever PR (bot or human) carried it.
"""
from __future__ import annotations

import re
import tomllib
from collections import deque
from datetime import datetime
from pathlib import PurePosixPath
from typing import Any

from packaging.version import InvalidVersion, Version

from collectors.waves import DONE, NOT_APPLICABLE, NOT_STARTED, PR_OPEN

UV_LOCK = "uv.lock"
REQUIREMENTS_DIR = "requirements"
PROJECT_SOURCES = ("editable", "virtual")


def normalized(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def is_pin_file(path: str) -> bool:
    parts = PurePosixPath(path).parts
    if path == UV_LOCK:
        return True
    if not path.endswith(".txt"):
        return False
    return parts[0] == REQUIREMENTS_DIR or (len(parts) == 1 and parts[0].startswith("requirements"))


def requirements_pins(text: str, package: str) -> list[str]:
    pattern = re.compile(r"^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*==\s*([^\s;#\\]+)", re.MULTILINE)
    wanted = normalized(package)
    return [version for name, version in pattern.findall(text) if normalized(name) == wanted]


def _project_roots(packages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [pkg for pkg in packages if any(key in (pkg.get("source") or {}) for key in PROJECT_SOURCES)]


def _runtime_deps(pkg: dict[str, Any], *, include_extras: bool) -> list[str]:
    deps = [dep["name"] for dep in pkg.get("dependencies") or []]
    if include_extras:
        deps += [dep["name"] for extra in (pkg.get("optional-dependencies") or {}).values() for dep in extra]
    return [normalized(name) for name in deps]


def _reachable(packages: list[dict[str, Any]]) -> set[str]:
    """Names reachable from the project's own runtime dependencies and extras, not its dev groups."""
    by_name: dict[str, list[dict[str, Any]]] = {}
    for pkg in packages:
        by_name.setdefault(normalized(pkg["name"]), []).append(pkg)
    queue = deque(name for root in _project_roots(packages) for name in _runtime_deps(root, include_extras=True))
    seen: set[str] = set()
    while queue:
        name = queue.popleft()
        if name in seen:
            continue
        seen.add(name)
        queue.extend(dep for pkg in by_name.get(name, []) for dep in _runtime_deps(pkg, include_extras=False))
    return seen


def uv_pins(text: str, package: str) -> list[tuple[str, bool]]:
    """(version, runtime) for each locked version of ``package``."""
    try:
        packages = tomllib.loads(text).get("package") or []
    except tomllib.TOMLDecodeError:
        return []
    wanted = normalized(package)
    runtime = wanted in _reachable(packages)
    return [(pkg["version"], runtime) for pkg in packages if normalized(pkg["name"]) == wanted and "version" in pkg]


def is_runtime_file(path: str, runtime_files: list[str]) -> bool:
    return PurePosixPath(path).name in runtime_files


def pins(path: str, text: str, campaign: dict[str, Any]) -> list[dict[str, Any]]:
    package = campaign["package"]
    if path == UV_LOCK:
        return [{"path": path, "version": version, "runtime": runtime} for version, runtime in uv_pins(text, package)]
    runtime = is_runtime_file(path, campaign.get("runtime_files") or [])
    return [{"path": path, "version": version, "runtime": runtime} for version in requirements_pins(text, package)]


def below_floor(pin: dict[str, Any], min_version: str) -> bool:
    try:
        return Version(pin["version"]) < Version(min_version)
    except InvalidVersion:
        return True


def repo_status(
    full_name: str, repo_pins: list[dict[str, Any]], campaign: dict[str, Any], open_pr: dict[str, Any] | None, *, now: datetime
) -> dict[str, Any]:
    stale = [pin for pin in repo_pins if below_floor(pin, campaign["min_version"])]
    if not repo_pins:
        status = NOT_APPLICABLE
    elif not stale:
        status = DONE
    elif open_pr:
        status = PR_OPEN
    else:
        status = NOT_STARTED
    created = datetime.fromisoformat(open_pr["createdAt"].replace("Z", "+00:00")) if open_pr else None
    with_pr = status == PR_OPEN
    return {
        "repo_name": full_name,
        "status": status,
        "pinned": sorted({pin["version"] for pin in repo_pins}),
        "below_floor": stale,
        "runtime_exposed": any(pin["runtime"] for pin in stale),
        "pr_url": open_pr["url"] if with_pr else None,
        "pr_title": open_pr["title"] if with_pr else None,
        "pr_age_days": (now - created).days if created and with_pr else None,
    }


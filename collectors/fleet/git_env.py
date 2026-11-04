from __future__ import annotations

import base64
import os
import re
import subprocess
from typing import Any

from collectors.github import token_for_owner

GITHUB_REMOTE = re.compile(r"^https://github\.com/([^/]+)/")
GIT_TIMEOUT_SECONDS = 900


def _owner_of_remote(url: str) -> str | None:
    match = GITHUB_REMOTE.match(url)
    return match.group(1) if match else None


def _basic_credentials(token: str) -> str:
    return base64.b64encode(f"x-access-token:{token}".encode()).decode()


def git_env(url: str, base: dict[str, str] | None = None) -> dict[str, str]:
    """The environment for a git call against ``url``: the owner's token as a scoped http header, never on argv."""
    env = {**(os.environ if base is None else base), "GIT_TERMINAL_PROMPT": "0"}
    owner = _owner_of_remote(url)
    token = token_for_owner(owner)
    if not token:
        return env
    index = int(env.get("GIT_CONFIG_COUNT") or 0)
    return {
        **env,
        "GIT_CONFIG_COUNT": str(index + 1),
        f"GIT_CONFIG_KEY_{index}": f"http.https://github.com/{owner}/.extraheader",
        f"GIT_CONFIG_VALUE_{index}": f"Authorization: basic {_basic_credentials(token)}",
    }


def run_git(args: list[str], *, url: str, label: str, **kwargs: Any) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(["git", *args], capture_output=True, text=True, env=git_env(url), timeout=GIT_TIMEOUT_SECONDS, **kwargs)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f"{label} took over {GIT_TIMEOUT_SECONDS}s") from error

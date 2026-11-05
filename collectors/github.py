"""Minimal read-only GitHub access through the ``gh`` CLI.

Each call is authenticated by GH_TOKEN, or by the token GH_OWNER_TOKENS (a JSON object of owner to token) holds for
the owner the call reads, so one run can read private repos of several owners that no single token covers.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
from functools import lru_cache
from typing import Any
from urllib.parse import quote

import requests

RETRIES = 3
SEARCH_PAUSE_SECONDS = 2.5
OWNER_TOKENS_ENV = "GH_OWNER_TOKENS"
REPO_PATH = re.compile(r"^/?repos/([^/?]+)/")
OWNER_FIELD = "owner="
GH_TIMEOUT_SECONDS = 120
TIMEOUT_RETURNCODE = 124
HTTP_STATUS = re.compile(r"HTTP (\d{3})")


@lru_cache(maxsize=8)
def _parsed_owner_tokens(raw: str) -> dict[str, str]:
    tokens = json.loads(raw) if raw else {}
    return {owner.lower(): token for owner, token in tokens.items()}


def owner_tokens(raw: str | None) -> dict[str, str]:
    """Owners compared case-insensitively, as GitHub does."""
    return dict(_parsed_owner_tokens(raw or ""))


def owner_of(args: tuple[str, ...]) -> str | None:
    """The owner an ``api`` call reads: the ``repos/<owner>/`` path, or a GraphQL ``owner`` variable."""
    for arg in args:
        match = REPO_PATH.match(arg)
        if match:
            return match.group(1)
        if arg.startswith(OWNER_FIELD):
            return arg.removeprefix(OWNER_FIELD)
    return None


def token_for_owner(owner: str | None) -> str | None:
    return _parsed_owner_tokens(os.environ.get(OWNER_TOKENS_ENV) or "").get(owner.lower()) if owner else None


def _env(args: tuple[str, ...]) -> dict[str, str] | None:
    """None keeps the process environment (GH_TOKEN) when no owner token applies."""
    token = token_for_owner(owner_of(args))
    return {**os.environ, "GH_TOKEN": token} if token else None


def segment(value: str) -> str:
    return quote(value, safe="")


def quoted_path(path: str) -> str:
    return "/".join(segment(part) for part in path.split("/"))


def _is_rate_limited(stderr: str) -> bool:
    lowered = stderr.lower()
    return "rate limit" in lowered or "abuse" in lowered


def is_retryable(stderr: str) -> bool:
    """Client errors repeat on every attempt; rate limits, 429, server errors and network failures can pass."""
    match = HTTP_STATUS.search(stderr)
    if not match:
        return True
    status = int(match.group(1))
    if status in (403, 429):
        return _is_rate_limited(stderr) or status == 429
    return not 400 <= status < 500


def _attempt(args: tuple[str, ...]) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(["gh", *args], capture_output=True, text=True, env=_env(args), timeout=GH_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(["gh", *args], TIMEOUT_RETURNCODE, "", f"timed out after {GH_TIMEOUT_SECONDS}s")


def gh_json(*args: str) -> Any:
    result: subprocess.CompletedProcess[str] | None = None
    for attempt in range(RETRIES):
        result = _attempt(args)
        if result.returncode == 0:
            return json.loads(result.stdout or "null")
        if not is_retryable(result.stderr):
            break
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"gh {' '.join(args)} failed: {result.stderr if result else ''}")


def _gh_optional(*args: str) -> str | None:
    """stdout of a ``gh`` call, or None when GitHub answers 404; other failures raise."""
    result: subprocess.CompletedProcess[str] | None = None
    for attempt in range(RETRIES):
        result = _attempt(args)
        if result.returncode == 0:
            return result.stdout
        if "HTTP 404" in result.stderr:
            return None
        if not is_retryable(result.stderr):
            break
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"gh {' '.join(args)} failed: {result.stderr if result else ''}")


def api_optional(path: str) -> Any | None:
    """Parsed JSON of a GitHub API path, or None when GitHub answers 404."""
    out = _gh_optional("api", path)
    return None if out is None else json.loads(out or "null")


def file_content(full_name: str, path: str, ref: str) -> str | None:
    """Raw text of a file on ``ref``, or None when the repo has no such file."""
    return _gh_optional("api", f"repos/{quoted_path(full_name)}/contents/{quoted_path(path)}?ref={segment(ref)}", "-H", "Accept: application/vnd.github.raw")


def latest_release_tag(full_name: str) -> str | None:
    release = api_optional(f"repos/{quoted_path(full_name)}/releases/latest")
    return release.get("tag_name") if release else None


def tag_targets(full_name: str, prefix: str) -> dict[str, dict[str, str]]:
    """Tags under ``prefix`` mapped to the git object each points at."""
    refs = api_optional(f"repos/{quoted_path(full_name)}/git/matching-refs/tags/{quoted_path(prefix)}") or []
    return {ref["ref"].removeprefix("refs/tags/"): ref["object"] for ref in refs}


def tagged_commit_date(full_name: str, target: dict[str, str]) -> str | None:
    """Committer date of the commit a tag points at, following an annotated tag to its commit."""
    sha = target["sha"]
    if target["type"] == "tag":
        tag = api_optional(f"repos/{quoted_path(full_name)}/git/tags/{segment(sha)}")
        if not tag:
            return None
        sha = tag["object"]["sha"]
    commit = api_optional(f"repos/{quoted_path(full_name)}/git/commits/{segment(sha)}")
    return commit["committer"]["date"] if commit else None


MERGED_BY_QUERY = (
    "query($owner:String!,$name:String!,$base:String!,$after:String){repository(owner:$owner,name:$name)"
    "{pullRequests(states:MERGED,baseRefName:$base,first:100,after:$after,orderBy:{field:CREATED_AT,direction:DESC})"
    "{pageInfo{hasNextPage endCursor} nodes{mergedBy{login __typename}}}}}"
)
MERGED_PAGE_LIMIT = 50


def _merged_page(owner: str, name: str, base_branch: str, after: str | None) -> dict[str, Any] | None:
    args = ["api", "graphql", "-f", f"query={MERGED_BY_QUERY}", "-f", f"owner={owner}", "-f", f"name={name}", "-f", f"base={base_branch}"]
    if after:
        args += ["-f", f"after={after}"]
    repository = ((gh_json(*args) or {}).get("data") or {}).get("repository")
    return repository["pullRequests"] if repository else None


def merged_by_logins(owner: str, name: str, base_branch: str) -> list[str] | None:
    """Who merged every pull request into ``base_branch`` of this repo, newest first; bots are skipped."""
    logins: list[str] = []
    after: str | None = None
    for _ in range(MERGED_PAGE_LIMIT):
        page = _merged_page(owner, name, base_branch, after)
        if page is None:
            return None
        mergers = (node.get("mergedBy") for node in page["nodes"])
        logins += [merger["login"] for merger in mergers if merger and merger.get("__typename") != "Bot"]
        if not page["pageInfo"]["hasNextPage"]:
            break
        after = page["pageInfo"]["endCursor"]
    return logins


def user_exists(login: str) -> bool:
    return _gh_optional("api", f"users/{segment(login)}", "--jq", ".login") is not None


def org_repos(org: str, *, include_archived: bool = False) -> list[dict[str, Any]]:
    pages = gh_json("api", f"orgs/{segment(org)}/repos", "--paginate", "--slurp")
    return [repo for page in pages for repo in page if include_archived or not repo.get("archived")]


def labelled_issues(full_name: str, label: str) -> list[dict[str, Any]]:
    """Every issue, open or closed, with ``label``; pull requests left out."""
    pages = gh_json("api", f"repos/{quoted_path(full_name)}/issues?labels={segment(label)}&state=all&per_page=100", "--paginate", "--slurp")
    return [issue for page in pages for issue in page if "pull_request" not in issue]


def top_level_paths(full_name: str, ref: str) -> set[str]:
    try:
        entries = gh_json("api", f"repos/{quoted_path(full_name)}/contents/?ref={segment(ref)}")
    except RuntimeError:
        return set()
    return {entry["name"] for entry in entries or []}


def _tree(full_name: str, tree_ref: str, *, recursive: bool) -> list[dict[str, Any]]:
    suffix = "?recursive=1" if recursive else ""
    try:
        return (gh_json("api", f"repos/{quoted_path(full_name)}/git/trees/{segment(tree_ref)}{suffix}") or {}).get("tree") or []
    except RuntimeError:
        return []


def blob_paths(full_name: str, tree_ref: str) -> list[str] | None:
    """Every file path in a tree, or None when GitHub truncates the listing or has no such tree."""
    data = api_optional(f"repos/{quoted_path(full_name)}/git/trees/{segment(tree_ref)}?recursive=1")
    if not data or data.get("truncated"):
        return None
    return [entry["path"] for entry in data.get("tree") or [] if entry["type"] == "blob"]


def tree_before(full_name: str, ref: str, before: str) -> str | None:
    """Tree SHA of the last commit on ``ref`` before the ISO timestamp ``before``."""
    commits = api_optional(f"repos/{quoted_path(full_name)}/commits?sha={segment(ref)}&until={segment(before)}&per_page=1")
    return commits[0]["commit"]["tree"]["sha"] if commits else None


def file_paths(full_name: str, ref: str, subdir: str) -> list[str]:
    """Top-level paths of ``ref`` plus every path under the ``subdir`` folder, without walking the whole repo."""
    top = _tree(full_name, ref, recursive=False)
    paths = [entry["path"] for entry in top]
    folder = next((entry for entry in top if entry["path"] == subdir and entry["type"] == "tree"), None)
    if folder:
        paths += [f"{subdir}/{entry['path']}" for entry in _tree(full_name, folder["sha"], recursive=True)]
    return paths


RAW_BASE = "https://raw.githubusercontent.com"


def raw_text(full_name: str, ref: str, path: str) -> str | None:
    """A public file's text from the raw host, which does not count against the API rate limit."""
    for attempt in range(RETRIES):
        try:
            response = requests.get(f"{RAW_BASE}/{quoted_path(full_name)}/{segment(ref)}/{quoted_path(path)}", timeout=30)
        except requests.RequestException:
            time.sleep(5 * (attempt + 1))
            continue
        if response.status_code == 404:
            return None
        if response.ok:
            return response.text
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"raw fetch of {full_name}/{ref}/{path} failed")


def search_open_prs(org: str, term: str) -> list[dict[str, Any]]:
    time.sleep(SEARCH_PAUSE_SECONDS)
    return gh_json(
        "search", "prs", "--owner", org, "--state", "open", "--limit", "1000",
        "--json", "repository,title,url,createdAt", "--", f"{term} in:title",
    ) or []


def search_open_prs_by_author(org: str, author: str, title: str) -> list[dict[str, Any]]:
    time.sleep(SEARCH_PAUSE_SECONDS)
    return gh_json(
        "search", "prs", "--owner", org, "--state", "open", "--author", author, "--limit", "1000",
        "--json", "repository,title,url,number,createdAt", "--", f"{_search_words(title)} in:title",
    ) or []


MARKER_PR_QUERY = (
    "query($q:String!,$after:String){search(query:$q,type:ISSUE,first:100,after:$after)"
    "{issueCount pageInfo{hasNextPage endCursor} nodes{... on PullRequest{number url title body state isDraft createdAt updatedAt"
    " author{login} baseRepository{nameWithOwner} headRepository{nameWithOwner}}}}}"
)
MARKER_PAGE_LIMIT = 10


def search_open_prs_by_body(org: str, search: str) -> list[dict[str, Any]]:
    """Open PRs in ``org`` matching a body search, with draft state and base/head repos."""
    query = f"{search} org:{org}"
    nodes: list[dict[str, Any]] = []
    after: str | None = None
    for _ in range(MARKER_PAGE_LIMIT):
        time.sleep(SEARCH_PAUSE_SECONDS)
        args = ["api", "graphql", "-f", f"query={MARKER_PR_QUERY}", "-f", f"q={query}"]
        if after:
            args += ["-f", f"after={after}"]
        page = (gh_json(*args) or {}).get("data", {}).get("search") or {}
        nodes.extend(node for node in page.get("nodes", []) if node)
        info = page.get("pageInfo") or {}
        if not info.get("hasNextPage"):
            break
        after = info.get("endCursor")
    return nodes


def merged_prs(full_name: str, search: str) -> list[dict[str, Any]]:
    return gh_json(
        "pr", "list", "--repo", full_name, "--state", "merged", "--limit", "20",
        "--search", f"{_search_words(search)} in:title", "--json", "number,title,url,mergedAt,author",
    ) or []


def merge_state(full_name: str, number: int) -> str:
    return (gh_json("pr", "view", str(number), "--repo", full_name, "--json", "mergeStateStatus") or {}).get(
        "mergeStateStatus", "UNKNOWN"
    )


def _search_words(text: str) -> str:
    return " ".join(re.sub(r"[^\w\s]", " ", text).split())

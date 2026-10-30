"""Minimal read-only GitHub access through the ``gh`` CLI (authenticated by GH_TOKEN)."""
from __future__ import annotations

import json
import re
import subprocess
import time
from typing import Any

import requests

RETRIES = 3
SEARCH_PAUSE_SECONDS = 2.5


def gh_json(*args: str) -> Any:
    last_error: subprocess.CalledProcessError | None = None
    for attempt in range(RETRIES):
        try:
            result = subprocess.run(["gh", *args], check=True, capture_output=True, text=True)
            return json.loads(result.stdout or "null")
        except subprocess.CalledProcessError as error:
            last_error = error
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"gh {' '.join(args)} failed: {last_error.stderr if last_error else ''}")


def _gh_optional(*args: str) -> str | None:
    """stdout of a ``gh`` call, or None when GitHub answers 404; other failures raise."""
    for attempt in range(RETRIES):
        result = subprocess.run(["gh", *args], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout
        if "HTTP 404" in result.stderr:
            return None
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"gh {' '.join(args)} failed: {result.stderr}")


def api_optional(path: str) -> Any | None:
    """Parsed JSON of a GitHub API path, or None when GitHub answers 404."""
    out = _gh_optional("api", path)
    return None if out is None else json.loads(out or "null")


def file_content(full_name: str, path: str, ref: str) -> str | None:
    """Raw text of a file on ``ref``, or None when the repo has no such file."""
    return _gh_optional("api", f"repos/{full_name}/contents/{path}?ref={ref}", "-H", "Accept: application/vnd.github.raw")


def latest_release_tag(full_name: str) -> str | None:
    release = api_optional(f"repos/{full_name}/releases/latest")
    return release.get("tag_name") if release else None


def tag_targets(full_name: str, prefix: str) -> dict[str, dict[str, str]]:
    """Tags under ``prefix`` mapped to the git object each points at."""
    refs = api_optional(f"repos/{full_name}/git/matching-refs/tags/{prefix}") or []
    return {ref["ref"].removeprefix("refs/tags/"): ref["object"] for ref in refs}


def tagged_commit_date(full_name: str, target: dict[str, str]) -> str | None:
    """Committer date of the commit a tag points at, following an annotated tag to its commit."""
    sha = target["sha"]
    if target["type"] == "tag":
        tag = api_optional(f"repos/{full_name}/git/tags/{sha}")
        if not tag:
            return None
        sha = tag["object"]["sha"]
    commit = api_optional(f"repos/{full_name}/git/commits/{sha}")
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
    return _gh_optional("api", f"users/{login}", "--jq", ".login") is not None


def org_repos(org: str) -> list[dict[str, Any]]:
    pages = gh_json("api", f"orgs/{org}/repos", "--paginate", "--slurp")
    return [repo for page in pages for repo in page if not repo.get("archived")]


def top_level_paths(full_name: str, ref: str) -> set[str]:
    try:
        entries = gh_json("api", f"repos/{full_name}/contents/?ref={ref}")
    except RuntimeError:
        return set()
    return {entry["name"] for entry in entries or []}


def _tree(full_name: str, tree_ref: str, *, recursive: bool) -> list[dict[str, Any]]:
    suffix = "?recursive=1" if recursive else ""
    try:
        return (gh_json("api", f"repos/{full_name}/git/trees/{tree_ref}{suffix}") or {}).get("tree") or []
    except RuntimeError:
        return []


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
            response = requests.get(f"{RAW_BASE}/{full_name}/{ref}/{path}", timeout=30)
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

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
import tempfile
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from collectors import (
    campaigns,
    catalog,
    endoflife,
    fix_prs,
    github,
    merge,
    publish,
    redundant_prs,
    support_windows,
    upgrade_jobs,
    waves,
)
from dashboard.lib.clock import now_utc
from dashboard.lib.config import DEFAULT_ORG, get_config

UPGRADE_JOBS_FILE = "upgrade_jobs.json"
WAVES_DIR = "waves"
CAMPAIGNS_DIR = "campaigns"
REDUNDANT_PRS_FILE = "redundant_prs.json"
CATALOG_FILE = "catalog.json"
CATALOG_PATH = "catalog-info.yaml"
FIX_PRS_FILE = "fix_prs.json"
SUPPORT_WINDOWS_FILE = "support_windows.json"
TUTOR_DEFAULTS = "tutor/templates/config/defaults.yml"
OPENEDX_RELEASE_PATTERN = r'OPENEDX_COMMON_VERSION: "([^"]+)"'
RELEASE_TAG_PATTERN = r"^([a-z]+)\.1$"
MISSING_DECLARED = support_windows.Declared(support_windows.MISSING)
TREE_WORKERS = 8
COLLECTORS = ("upgrade_jobs", "waves", "campaigns", "redundant_prs", "catalog", "fix_prs", "support_windows")
ORG_WIDE = ("upgrade_jobs", "support_windows")
MERGEABLE = tuple(name for name in COLLECTORS if name not in ORG_WIDE)

Records = list[dict[str, Any]]


@dataclass(frozen=True)
class Target:
    org: str
    github_org: str


@dataclass(frozen=True)
class Scope:
    repos: list[str]
    merge: bool

    def includes(self, name: str) -> bool:
        return not self.repos or name in self.repos

    def refreshed(self, github_org: str) -> set[str]:
        return {f"{github_org}/{name}" for name in self.repos}


def _target(org: str) -> Target:
    return Target(org=org, github_org=get_config("data_source", org).get("github_org", org))


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect maintenance signals into files the dashboard reads.")
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--org", default=DEFAULT_ORG, help="Config folder under dashboard/config.")
    parser.add_argument("--repo", action="append", default=[], help="Limit to these repos (bare names); default is the whole org.")
    parser.add_argument("--collector", action="append", choices=COLLECTORS, help="Run only these collectors; default is all.")
    parser.add_argument(
        "--merge",
        action="store_true",
        help="Fold the --repo results into the files already in --out-dir instead of replacing them.",
    )
    args = parser.parse_args()
    if args.merge and not args.repo:
        parser.error("--merge needs at least one --repo")
    for name in ORG_WIDE:
        if args.merge and name in (args.collector or []):
            parser.error(f"{name} has no per-repo merge; run it without --merge")
    return args


def _publish(
    path: Path,
    fresh: Records,
    *,
    scope: Scope,
    target: Target,
    generated_at: datetime,
    order: Callable[[Records], Records],
    derive: Callable[[Records], dict[str, Any]] = lambda _: {},
    full_run: dict[str, Any] | None = None,
    **metadata: Any,
) -> Records | None:
    """Write ``fresh`` as the whole file, or merged into the published file for a --merge run.

    ``derive`` recomputes metadata from the final records; ``full_run`` fields only
    make sense for a whole-org run, so a merge keeps the published values.
    """
    if not scope.merge:
        final = order(fresh)
        publish.write(path, publish.payload(final, generated_at=generated_at, **metadata, **(full_run or {}), **derive(final)))
        return final
    existing = merge.published(path)
    if existing is None:
        print(f"{path.name}: nothing published to merge into; skipped.")
        return None
    refreshed = scope.refreshed(target.github_org)
    final = order(merge.records(existing["records"], fresh, refreshed))
    publish.write(path, merge.payload(existing, final, refreshed_at=generated_at, refreshed=refreshed, **metadata, **derive(final)))
    return final


def _org_repos(scope: Scope, target: Target) -> list[dict]:
    return [repo for repo in github.org_repos(target.github_org) if scope.includes(repo["name"])]


def collect_upgrade_jobs(out_dir: Path, scope: Scope, target: Target) -> int:
    generated_at = now_utc()
    with tempfile.TemporaryDirectory() as tmp:
        rows = upgrade_jobs.read_rows(upgrade_jobs.run_tool(target.github_org, Path(tmp), scope.repos))
    records = upgrade_jobs.records(rows, org=target.github_org, today=generated_at.date())
    if not records:
        print("No upgrade-job records; not writing.")
        return 1
    states = upgrade_jobs.counts(records)
    content = publish.payload(
        records,
        generated_at=generated_at,
        source=upgrade_jobs.SOURCE,
        repos_checked=len(records),
        states=states,
    )
    publish.write(out_dir / UPGRADE_JOBS_FILE, content)
    print(f"Upgrade jobs: {len(records)} repos, {states}")
    return 0


def _repo_trees(repos: list[dict]) -> dict[str, set[str]]:
    def tree(repo: dict) -> tuple[str, set[str]]:
        return repo["full_name"], github.top_level_paths(repo["full_name"], repo["default_branch"])

    with ThreadPoolExecutor(max_workers=TREE_WORKERS) as pool:
        return dict(pool.map(tree, repos))


def _summarized(records: Records) -> dict[str, Any]:
    return {"summary": waves.summary(records)}


def collect_waves(out_dir: Path, scope: Scope, target: Target) -> int:
    generated_at = now_utc()
    repos = _org_repos(scope, target)
    if not repos and not scope.merge:
        print("No repositories found; not writing waves.")
        return 1
    trees = _repo_trees(repos)
    for wave_id, wave in get_config("waves", target.org).get("waves", {}).items():
        prs = [pr for term in wave["pull_requests"]["search_terms"] for pr in github.search_open_prs(target.github_org, term)]
        open_prs = waves.matching_prs(prs, wave)
        fresh = [waves.repo_status(name, paths, wave, open_prs.get(name), now=generated_at) for name, paths in trees.items()]
        final = _publish(
            out_dir / WAVES_DIR / f"{wave_id}.json",
            fresh,
            scope=scope,
            target=target,
            generated_at=generated_at,
            order=waves.ordered,
            derive=_summarized,
            source="GitHub repository contents and PR search",
            wave_id=wave_id,
            title=wave["title"],
            epic=wave.get("epic"),
        )
        if final is not None:
            print(f"Wave {wave_id}: {waves.summary(final)}")
    return 0


def _repo_pins(repo: dict, campaign: dict) -> list[dict]:
    full_name, ref = repo["full_name"], repo["default_branch"]
    found = []
    for path in filter(campaigns.is_pin_file, github.file_paths(full_name, ref, campaigns.REQUIREMENTS_DIR)):
        text = github.raw_text(full_name, ref, path)
        if text:
            found += campaigns.pins(path, text, campaign)
    return found


def _campaign_pins(repos: list[dict], campaign: dict) -> dict[str, list[dict]]:
    def repo_pins(repo: dict) -> tuple[str, list[dict]]:
        return repo["full_name"], _repo_pins(repo, campaign)

    with ThreadPoolExecutor(max_workers=TREE_WORKERS) as pool:
        return dict(pool.map(repo_pins, repos))


def collect_campaigns(out_dir: Path, scope: Scope, target: Target) -> int:
    generated_at = now_utc()
    repos = _org_repos(scope, target)
    if not repos and not scope.merge:
        print("No repositories found; not writing campaigns.")
        return 1
    for campaign_id, campaign in get_config("campaigns", target.org).get("campaigns", {}).items():
        prs = [pr for term in campaign["pull_requests"]["search_terms"] for pr in github.search_open_prs(target.github_org, term)]
        open_prs = campaigns.matching_prs(prs, campaign)
        fresh = [
            campaigns.repo_status(name, repo_pins, campaign, open_prs.get(name), now=generated_at)
            for name, repo_pins in _campaign_pins(repos, campaign).items()
        ]
        final = _publish(
            out_dir / CAMPAIGNS_DIR / f"{campaign_id}.json",
            fresh,
            scope=scope,
            target=target,
            generated_at=generated_at,
            order=waves.ordered,
            derive=_summarized,
            source="requirements files and uv.lock on each repo's default branch; GitHub PR search",
            campaign_id=campaign_id,
            title=campaign["title"],
            package=campaign["package"],
            min_version=campaign["min_version"],
        )
        if final is not None:
            print(f"Campaign {campaign_id}: {waves.summary(final)}")
    return 0


def collect_redundant_prs(out_dir: Path, scope: Scope, target: Target) -> int:
    generated_at = now_utc()
    found, checked = [], 0
    for campaign_id, campaign in get_config("campaign_supersession", target.org).get("campaigns", {}).items():
        bot_prs = [
            pr for pr in github.search_open_prs_by_author(target.github_org, campaign["bot_author"], campaign["bot_title_prefix"])
            if pr["title"].startswith(campaign["bot_title_prefix"])
            and scope.includes(pr["repository"]["nameWithOwner"].split("/", 1)[1])
        ]
        checked += len(bot_prs)
        for bot_pr in bot_prs:
            repo = bot_pr["repository"]["nameWithOwner"]
            human_pr = redundant_prs.superseding_pr(
                bot_pr, github.merged_prs(repo, campaign["human_search"]), campaign["human_title_regex"]
            )
            if human_pr:
                found.append(
                    redundant_prs.record(campaign_id, bot_pr, human_pr, github.merge_state(repo, bot_pr["number"]))
                )
    final = _publish(
        out_dir / REDUNDANT_PRS_FILE,
        found,
        scope=scope,
        target=target,
        generated_at=generated_at,
        order=redundant_prs.ordered,
        derive=lambda records: {"redundant": len(records)},
        full_run={"bot_prs_checked": checked},
        source="GitHub PR search; dry run, nothing closed",
    )
    if final is not None:
        print(f"Redundant PRs: {len(final)} redundant; {checked} open bot campaign PRs checked")
    return 0


def _catalog_texts(repos: list[dict]) -> dict[str, str | None]:
    def fetch(repo: dict) -> tuple[str, str | None]:
        return repo["full_name"], github.file_content(repo["full_name"], CATALOG_PATH, repo["default_branch"])

    with ThreadPoolExecutor(max_workers=TREE_WORKERS) as pool:
        return dict(pool.map(fetch, repos))


def _existing_users(logins: set[str]) -> set[str]:
    with ThreadPoolExecutor(max_workers=TREE_WORKERS) as pool:
        return {login for login, exists in zip(logins, pool.map(github.user_exists, logins)) if exists}


def _other_entities(path: Path, scope: Scope, target: Target) -> frozenset[str]:
    """Entity names the published catalog holds for repos this run leaves alone."""
    existing = merge.published(path) if scope.merge else None
    if existing is None:
        return frozenset()
    refreshed = scope.refreshed(target.github_org)
    return frozenset(catalog.entity_names([entry for entry in existing["records"] if entry["repo_name"] not in refreshed]))


def _by_repo(records: Records) -> Records:
    return sorted(records, key=lambda entry: entry["repo_name"])


def collect_catalog(out_dir: Path, scope: Scope, target: Target) -> int:
    generated_at = now_utc()
    repos = _org_repos(scope, target)
    if not repos and not scope.merge:
        print("No repositories found; not writing the catalog.")
        return 1
    path = out_dir / CATALOG_FILE
    texts = _catalog_texts(repos)
    owners = catalog.user_owner_logins([catalog.record(name, text) for name, text in texts.items()])
    fresh = catalog.snapshot(texts, _existing_users(owners), _other_entities(path, scope, target))
    final = _publish(
        path,
        fresh,
        scope=scope,
        target=target,
        generated_at=generated_at,
        order=_by_repo,
        derive=lambda records: {"summary": catalog.summary(records)},
        source="catalog-info.yaml on each repo's default branch; GitHub user lookups for user owners",
        findings=catalog.FINDINGS,
    )
    if final is not None:
        print(f"Catalog: {catalog.summary(final)}")
    return 0


def collect_fix_prs(out_dir: Path, scope: Scope, target: Target) -> int:
    generated_at = now_utc()
    hits = github.search_open_prs_by_body(target.github_org, fix_prs.MARKER_SEARCH)
    found = [entry for entry in fix_prs.records(hits) if scope.includes(entry["repo_name"].split("/", 1)[1])]
    final = _publish(
        out_dir / FIX_PRS_FILE,
        found,
        scope=scope,
        target=target,
        generated_at=generated_at,
        order=fix_prs.ordered,
        full_run={"candidates": len(hits)},
        source=fix_prs.SOURCE,
    )
    if final is not None:
        print(f"Fix PRs: {len(final)} open remediation PRs from {len(hits)} candidates")
    return 0


@dataclass(frozen=True)
class ResolvedRef:
    repo: str
    ref: str | None


def _resolve_refs(refs: dict[str, dict[str, str]]) -> dict[str, ResolvedRef]:
    """Each named ref as a concrete tag or branch; ``openedx_release`` needs the Tutor ref first."""
    resolved: dict[str, ResolvedRef] = {}
    for name, entry in sorted(refs.items(), key=lambda item: item[1]["ref"] == "openedx_release"):
        resolved[name] = ResolvedRef(entry["repo"], _concrete_ref(entry, resolved))
    return resolved


def _concrete_ref(entry: dict[str, str], resolved: dict[str, ResolvedRef]) -> str | None:
    if entry["ref"] == "latest_release":
        return github.latest_release_tag(entry["repo"])
    if entry["ref"] == "openedx_release":
        tutor = resolved.get("tutor")
        defaults = github.file_content(tutor.repo, TUTOR_DEFAULTS, tutor.ref) if tutor and tutor.ref else None
        return support_windows.detect(defaults, OPENEDX_RELEASE_PATTERN)
    return entry["ref"]


def _detected(rule: dict[str, str], refs: dict[str, ResolvedRef]) -> support_windows.Detected:
    source = refs[rule["source"]]
    text = github.file_content(source.repo, rule["path"], source.ref) if source.ref else None
    return support_windows.Detected(support_windows.detect(text, rule["pattern"]), source.repo, source.ref, rule["path"])


def _release_dates(settings: dict[str, Any]) -> dict[str, datetime]:
    repo, dates = settings["tag_repo"], {}
    for prefix in settings["tag_prefixes"]:
        for tag, target in github.tag_targets(repo, prefix).items():
            name = support_windows.detect(tag.removeprefix(prefix), RELEASE_TAG_PATTERN)
            committed = github.tagged_commit_date(repo, target) if name else None
            if name and committed:
                dates[name] = datetime.fromisoformat(committed.replace("Z", "+00:00"))
    return dates


def _open_edx_record(settings: dict[str, Any], declared: dict, refs: dict[str, ResolvedRef], **context: Any) -> dict[str, Any]:
    released = {name: when.date() for name, when in _release_dates(settings).items()}
    cycles = support_windows.open_edx_cycles(released, settings.get("planned", []))
    found = _detected(settings["detect"], refs)
    detected = support_windows.Detected(
        found.version.capitalize() if found.version else None, found.repo, found.ref, found.path
    )
    return support_windows.product_record(
        "open_edx",
        settings,
        cycles,
        declared.get(settings["declared_key"], MISSING_DECLARED),
        detected,
        tracks_eol=False,
        **context,
    )


def _product_record(
    product: str, settings: dict[str, Any], declared: dict, refs: dict[str, ResolvedRef], **context: Any
) -> dict[str, Any] | None:
    rows = endoflife.cycles(settings["eol_slug"])
    if rows is None:
        print(f"Support windows: endoflife.date has nothing for {settings['eol_slug']}; skipped {product}.")
        return None
    cycles = support_windows.cycles_from_endoflife(rows, settings.get("cycles", "all"), settings.get("extra_cycles"))
    return support_windows.product_record(
        product,
        settings,
        cycles,
        declared.get(settings["declared_key"], MISSING_DECLARED),
        _detected(settings["detect"], refs),
        **context,
    )


def collect_support_windows(out_dir: Path, scope: Scope, target: Target) -> int:
    config = get_config("support_windows", target.org)
    if not config:
        print("Support windows: not configured for this org; skipped.")
        return 0
    generated_at = now_utc()
    refs = _resolve_refs(config["refs"])
    source = config["declared"]
    declared = support_windows.declared_versions(github.file_content(source["repo"], source["path"], source["ref"]))
    if not declared:
        print(f"Support windows: no CURRENT dict in {source['repo']} {source['path']}; kept the published file.")
        return 0
    context = {"today": generated_at.date(), "eol_soon_months": config.get("eol_soon_months", 12)}
    products = [
        _product_record(product, settings, declared, refs, **context)
        for product, settings in config["products"].items()
    ]
    records = [_open_edx_record(config["open_edx"], declared, refs, **context), *filter(None, products)]
    content = publish.payload(
        records,
        generated_at=generated_at,
        source=support_windows.SOURCE,
        declared_url=f"https://github.com/{source['repo']}/blob/{source['ref']}/{source['path']}",
        edit_url=f"https://github.com/{source['repo']}/edit/{source['ref']}/{source['path']}",
        refs={name: {"repo": ref.repo, "ref": ref.ref} for name, ref in refs.items()},
        window=config.get("window", {}),
        summary=support_windows.summary(records),
    )
    publish.write(out_dir / SUPPORT_WINDOWS_FILE, content)
    print(f"Support windows: {len(records)} products, {support_windows.summary(records)}")
    return 0


def main() -> int:
    args = _parse_args()
    selected = args.collector or list(MERGEABLE if args.merge else COLLECTORS)
    runners = {
        "upgrade_jobs": collect_upgrade_jobs,
        "waves": collect_waves,
        "campaigns": collect_campaigns,
        "redundant_prs": collect_redundant_prs,
        "catalog": collect_catalog,
        "fix_prs": collect_fix_prs,
        "support_windows": collect_support_windows,
    }
    target = _target(args.org)
    scope = Scope(repos=args.repo, merge=args.merge)
    results = [runners[name](args.out_dir, scope, target) for name in selected]
    return max(results)


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
import tempfile
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from collectors import (
    campaigns,
    catalog,
    endoflife,
    extension_points,
    fix_prs,
    github,
    merge,
    modularization,
    platform_history,
    platform_trends,
    publish,
    redundant_prs,
    support_windows,
    upgrade_jobs,
    waves,
)
from collectors.fleet.errors import public_message
from dashboard.lib.clock import now_utc
from dashboard.lib.config import DEFAULT_ORG, get_config
from dashboard.lib.health_settings import enabled_collectors, load_settings

UPGRADE_JOBS_FILE = "upgrade_jobs.json"
WAVES_DIR = "waves"
CAMPAIGNS_DIR = "campaigns"
REDUNDANT_PRS_FILE = "redundant_prs.json"
CATALOG_FILE = "catalog.json"
CATALOG_PATH = "catalog-info.yaml"
FIX_PRS_FILE = "fix_prs.json"
SUPPORT_WINDOWS_FILE = "support_windows.json"
MODULARIZATION_FILE = "modularization.json"
PLATFORM_TRENDS_FILE = "platform_trends.json"
EXTENSION_POINTS_FILE = "extension_points.json"
TUTOR_DEFAULTS = "tutor/templates/config/defaults.yml"
OPENEDX_RELEASE_PATTERN = r'OPENEDX_COMMON_VERSION: "([^"]+)"'
RELEASE_TAG_PATTERN = r"^([a-z]+)\.1$"
MISSING_DECLARED = support_windows.Declared(support_windows.MISSING)
TREE_WORKERS = 8
COLLECTORS = (
    "upgrade_jobs",
    "waves",
    "campaigns",
    "redundant_prs",
    "catalog",
    "fix_prs",
    "support_windows",
    "modularization",
    "platform_trends",
    "extension_points",
)
ORG_WIDE = ("upgrade_jobs", "support_windows", "modularization", "platform_trends", "extension_points")
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
        publish.write(path, publish.payload(final, generated_at=generated_at, **metadata, **(full_run or {}), **derive(final)), org=target.org)
        return final
    existing = merge.published(path)
    if existing is None:
        print(f"{path.name}: nothing published to merge into; skipped.")
        return None
    refreshed = scope.refreshed(target.github_org)
    final = order(merge.records(existing["records"], fresh, refreshed))
    publish.write(path, merge.payload(existing, final, refreshed_at=generated_at, refreshed=refreshed, **metadata, **derive(final)), org=target.org)
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
    publish.write(out_dir / UPGRADE_JOBS_FILE, content, org=target.org)
    print(f"Upgrade jobs: {len(records)} repos, {states}")
    return 0


def _repo_trees(repos: list[dict]) -> dict[str, set[str]]:
    def tree(repo: dict) -> tuple[str, set[str]]:
        return repo["full_name"], github.top_level_paths(repo["full_name"], repo["default_branch"])

    with ThreadPoolExecutor(max_workers=TREE_WORKERS) as pool:
        return dict(pool.map(tree, repos))


def _summarized(records: Records) -> dict[str, Any]:
    return {"summary": waves.summary(records)}


def _wave_contents(repos: list[dict], trees: dict[str, set[str]], wave: dict) -> dict[str, dict[str, str | None]]:
    """Text of the files a wave's content rules read, fetched only for repos the wave applies to."""
    paths = waves.content_paths(wave)
    wanted = [repo for repo in repos if paths and waves.applies(repo["full_name"], trees.get(repo["full_name"], set()), wave)]

    def files(repo: dict) -> tuple[str, dict[str, str | None]]:
        return repo["full_name"], {path: github.raw_text(repo["full_name"], repo["default_branch"], path) for path in paths}

    with ThreadPoolExecutor(max_workers=TREE_WORKERS) as pool:
        return dict(pool.map(files, wanted))


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
        contents = _wave_contents(repos, trees, wave)
        fresh = [
            waves.repo_status(name, paths, wave, open_prs.get(name), now=generated_at, contents=contents.get(name))
            for name, paths in trees.items()
        ]
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


@dataclass(frozen=True)
class ReleaseTag:
    tag: str
    date: datetime


def release_tags(repo: str, prefixes: list[str]) -> dict[str, ReleaseTag]:
    """Each named release's <prefix><name>.1 tag and the date of the commit it points at."""
    found = {}
    for prefix in prefixes:
        for tag, target in github.tag_targets(repo, prefix).items():
            name = support_windows.detect(tag.removeprefix(prefix), RELEASE_TAG_PATTERN)
            committed = github.tagged_commit_date(repo, target) if name else None
            if name and committed:
                found[name] = ReleaseTag(tag, datetime.fromisoformat(committed.replace("Z", "+00:00")))
    return found


def _release_dates(settings: dict[str, Any]) -> dict[str, datetime]:
    return {name: release.date for name, release in release_tags(settings["tag_repo"], settings["tag_prefixes"]).items()}


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
    publish.write(out_dir / SUPPORT_WINDOWS_FILE, content, org=target.org)
    print(f"Support windows: {len(records)} products, {support_windows.summary(records)}")
    return 0


def _legacy_frontend_history(repo: str, ref: str, rules: dict, *, this_year: int) -> list[dict]:
    """Legacy frontend file count at the start of each year since ``since_year``; years GitHub cannot list are skipped."""
    points = []
    for year in range(rules["since_year"], this_year + 1):
        tree = github.tree_before(repo, ref, f"{year}-01-01T00:00:00Z")
        paths = github.blob_paths(repo, tree) if tree else None
        if paths is not None:
            points.append({"date": f"{year}-01-01", "count": modularization.legacy_frontend_count(paths, rules)})
    return points


def collect_modularization(out_dir: Path, scope: Scope, target: Target) -> int:
    config = get_config("modularization", target.org)
    if not config:
        print("Modularization: not configured for this org; skipped.")
        return 0
    generated_at = now_utc()
    repo, ref = config["repo"], config["ref"]
    toggles, pins, frontend = config["extracted_blocks"], config["pins"], config["legacy_frontend"]
    blocks = modularization.extracted_blocks(
        github.raw_text(repo, ref, toggles["path"]), toggles["pattern"], toggles.get("acronyms")
    )
    current_paths = github.blob_paths(repo, ref)
    if not blocks or current_paths is None:
        print(f"Modularization: could not read {repo}@{ref}; kept the published file.")
        return 0
    history = _legacy_frontend_history(repo, ref, frontend, this_year=generated_at.year)
    today = {"date": generated_at.date().isoformat(), "count": modularization.legacy_frontend_count(current_paths, frontend)}
    content = publish.payload(
        blocks,
        generated_at=generated_at,
        source=modularization.SOURCE,
        repo=repo,
        ref=ref,
        toggles_url=f"https://github.com/{repo}/blob/{ref}/{toggles['path']}",
        extracted_package=toggles.get("package"),
        pins=modularization.pinned_versions(github.raw_text(repo, ref, pins["path"]), pins["packages"]),
        pins_url=f"https://github.com/{repo}/blob/{ref}/{pins['path']}",
        legacy_frontend={"rules": frontend, "history": [*history, today]},
        summary=modularization.summary(blocks),
    )
    publish.write(out_dir / MODULARIZATION_FILE, content, org=target.org)
    print(f"Modularization: {modularization.summary(blocks)}, legacy frontend files {today['count']}")
    return 0


def _published_metadata(path: Path) -> dict[str, Any]:
    try:
        published = merge.published(path)
    except ValueError:
        return {}
    return (published or {}).get("metadata", {})


def is_current(published: dict[str, Any], *, through: str, config: dict[str, Any]) -> bool:
    """The series only grows when a month ends, so a file already through that month from the same code and settings stands."""
    return (
        published.get("through") == through
        and published.get("collector_version") == platform_trends.VERSION
        and published.get("settings") == config
    )


def _read_history(config: dict[str, Any], months: list[str]) -> tuple[str, list[platform_trends.Commit], dict[str, int | None]]:
    url, ref = f"https://github.com/{config['repo']}.git", config["ref"]
    first = date.fromisoformat(f"{months[0]}-01")
    with tempfile.TemporaryDirectory() as tmp:
        git_dir = Path(tmp) / "repo.git"
        platform_history.clone(url, ref, dest=git_dir)
        history = platform_history.commits(git_dir, ref, since=first, until=platform_trends.month_end(months[-1]), url=url)
        lines = platform_history.python_lines(git_dir, ref, months, config["python"], url=url)
        return platform_history.head(git_dir, ref, url=url), history, lines


def collect_platform_trends(out_dir: Path, scope: Scope, target: Target) -> int:
    config = get_config("platform_trends", target.org)
    if not config:
        print("Platform trends: not configured for this org; skipped.")
        return 0
    generated_at = now_utc()
    through = platform_trends.previous_month(generated_at.date())
    path = out_dir / PLATFORM_TRENDS_FILE
    if is_current(_published_metadata(path), through=through, config=config):
        print(f"Platform trends: already collected through {through}; kept the published file.")
        return 0
    months = platform_trends.months_between(config["since"], through)
    try:
        head, history, lines = _read_history(config, months)
    except Exception as error:  # noqa: BLE001 - any failure keeps the published file so the other collectors still publish
        print(f"::warning::Platform trends: {public_message(error)}; kept the published file.")
        return 0
    rules = {"python": config["python"], "mechanical": config["mechanical"], "bot_pattern": config["bot_pattern"]}
    by_month, by_year = platform_trends.tallies(history, months, rules)
    years = platform_trends.year_records(by_year, lines, since=months[0], through=through, organisation_rules=config["organisations"])
    content = publish.payload(
        platform_trends.month_records(by_month, lines),
        generated_at=generated_at,
        source=platform_trends.SOURCE,
        repo=config["repo"],
        ref=config["ref"],
        head=head,
        collector_version=platform_trends.VERSION,
        since=months[0],
        through=through,
        settings=config,
        years=years,
        summary=platform_trends.summary(years),
    )
    publish.write(path, content, org=target.org)
    print(f"Platform trends: {len(months)} months through {through}, {len(history)} commits read")
    return 0


def _package_count(settings: dict[str, Any], version: str | None) -> dict[str, Any]:
    """Declarations in the package at the tag of ``version``; the count is None when that tag does not exist."""
    if not version:
        return extension_points.package_record(None, None)
    ref = settings["tag"].format(version=version)
    paths = github.blob_paths(settings["repo"], ref)
    if paths is None:
        return extension_points.package_record(version, None)
    texts = [github.raw_text(settings["repo"], ref, path) or "" for path in extension_points.matching_paths(paths, settings["files"])]
    return extension_points.package_record(version, extension_points.declaration_count(texts, settings["declaration"]))


def _slot_counts(frontend_refs: dict[str, str], slots_roots: list[str]) -> dict[str, int]:
    """Plugin slots per frontend repo at its ref; a repo without that ref is left out."""
    counts = {}
    for repo, ref in frontend_refs.items():
        paths = github.blob_paths(repo, ref)
        if paths is not None:
            counts[repo] = len(extension_points.slot_names(paths, slots_roots))
    return counts


def _extension_row(config: dict[str, Any], release: str, ref: str, frontend_refs: dict[str, str], day: str) -> dict[str, Any]:
    platform, packages = config["platform"], config["packages"]
    requirements = github.raw_text(platform["repo"], ref, platform["requirements"])
    pins = modularization.pinned_versions(requirements, [settings["package"] for settings in packages.values()])
    return {
        "release": release,
        "ref": ref,
        "date": day,
        **{name: _package_count(settings, pins.get(settings["package"])) for name, settings in packages.items()},
        "plugin_slots": extension_points.slots_record(_slot_counts(frontend_refs, config["frontend"]["slots_roots"])),
    }


def _named_releases(config: dict[str, Any]) -> list[tuple[str, ReleaseTag]]:
    found = release_tags(config["platform"]["repo"], config["releases"]["tag_prefixes"])
    ordered = sorted(found.items(), key=lambda item: item[1].date)
    names = [name for name, _ in ordered]
    first = config["releases"]["first"]
    return ordered[names.index(first):] if first in names else ordered


def _extension_rows(config: dict[str, Any], published: dict[str, Any], today: str) -> Records:
    frontend = config["frontend"]
    repos = [repo for repo in github.org_repos(frontend["org"], include_archived=True) if re.search(frontend["repos"], repo["name"])]
    kept = {
        row["release"]: row
        for row in (published.get("records") or [])
        if extension_points.is_reusable(row, published.get("metadata", {}), config)
    }
    named = [
        kept.get(name)
        or _extension_row(config, name, release.tag, {repo["full_name"]: release.tag for repo in repos}, release.date.date().isoformat())
        for name, release in _named_releases(config)
    ]
    live = {repo["full_name"]: repo["default_branch"] for repo in repos if not repo.get("archived")}
    return [*named, _extension_row(config, extension_points.CURRENT, config["platform"]["ref"], live, today)]


def collect_extension_points(out_dir: Path, scope: Scope, target: Target) -> int:
    config = get_config("extension_points", target.org)
    if not config:
        print("Extension points: not configured for this org; skipped.")
        return 0
    generated_at = now_utc()
    path = out_dir / EXTENSION_POINTS_FILE
    try:
        published = merge.published(path) or {}
    except ValueError:
        published = {}
    try:
        rows = _extension_rows(config, published, generated_at.date().isoformat())
    except Exception as error:  # noqa: BLE001 - any failure keeps the published file so the other collectors still publish
        print(f"::warning::Extension points: {public_message(error)}; kept the published file.")
        return 0
    content = publish.payload(
        rows,
        generated_at=generated_at,
        source=extension_points.SOURCE,
        collector_version=extension_points.VERSION,
        settings=config,
        summary=extension_points.summary(rows),
    )
    publish.write(path, content, org=target.org)
    print(f"Extension points: {len(rows) - 1} releases, now {extension_points.summary(rows)}")
    return 0


def select_collectors(requested: list[str] | None, *, merge_run: bool, enabled: list[str]) -> list[str]:
    """The org's enabled collectors (mergeable ones for a --merge run); naming one the org turned off is an error."""
    if requested:
        off = [name for name in requested if name not in enabled]
        if off:
            raise SystemExit(f"Turned off for this org in its health settings: {', '.join(off)}")
        return requested
    return [name for name in (MERGEABLE if merge_run else COLLECTORS) if name in enabled]


def main() -> int:
    args = _parse_args()
    selected = select_collectors(args.collector, merge_run=args.merge, enabled=enabled_collectors(load_settings(args.org)))
    runners = {
        "upgrade_jobs": collect_upgrade_jobs,
        "waves": collect_waves,
        "campaigns": collect_campaigns,
        "redundant_prs": collect_redundant_prs,
        "catalog": collect_catalog,
        "fix_prs": collect_fix_prs,
        "support_windows": collect_support_windows,
        "modularization": collect_modularization,
        "platform_trends": collect_platform_trends,
        "extension_points": collect_extension_points,
    }
    target = _target(args.org)
    scope = Scope(repos=args.repo, merge=args.merge)
    results = [runners[name](args.out_dir, scope, target) for name in selected]
    return max(results, default=0)


if __name__ == "__main__":
    sys.exit(main())

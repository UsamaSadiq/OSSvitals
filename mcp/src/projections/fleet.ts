import type {
  AppRecord,
  AppsView,
  CarriedRecord,
  CarriedView,
  ConflictRecord,
  ConflictsView,
  DriftRecord,
  DriftView,
  UpgradeRecord,
  UpgradeView,
} from "../../../web/src/kinds/fleet/schemas.ts";
import { truncate } from "../text.ts";

const DESCRIPTION_LIMIT = 300;
const CONFLICT_FILE_LIMIT = 50;
const LIST_LIMIT = 20;

export const REPO_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

export interface AppFilter {
  status?: string;
  class?: AppRecord["class"];
}

function sameRepo(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function findByRepo<Record extends { repo: string }>(records: Record[], repo: string): Record | undefined {
  return records.find((record) => sameRepo(record.repo, repo));
}

export function unknownAppMessage(repo: string, org: string): string {
  return `Unknown app ${repo} for ${org}`;
}

export function projectAppSummary(app: AppRecord, drift: DriftRecord | undefined) {
  return {
    repo: app.repo,
    class: app.class,
    status: drift?.status ?? null,
    status_basis: drift?.status_basis ?? null,
    release_gap: drift?.release_gap ?? null,
    ahead_by: drift?.ahead_by ?? null,
    behind_by: drift?.behind_by ?? null,
    behind_release: drift?.behind_release ?? null,
    upstream: app.upstream,
    upstream_branch: app.upstream_branch,
    production_branch: app.production_branch,
    latest_tag: app.latest_tag,
    open_pull_requests: app.open_pull_requests ?? null,
    severe_since_fork_release: drift?.advisories?.severe_since_fork_release ?? null,
    severe_affecting_fork_release: drift?.advisories?.severe_affecting_fork_release ?? null,
    severe_since_our_code: drift?.advisories?.severe_since_our_code ?? null,
  };
}

function matchesFilter(summary: ReturnType<typeof projectAppSummary>, filter: AppFilter): boolean {
  if (filter.status !== undefined && !sameRepo(summary.status ?? "", filter.status)) return false;
  return filter.class === undefined || summary.class === filter.class;
}

export function listApps(apps: AppsView, drift: DriftView, filter: AppFilter) {
  return apps.records
    .map((app) => projectAppSummary(app, findByRepo(drift.records, app.repo)))
    .filter((summary) => matchesFilter(summary, filter));
}

function projectAdvisoryCounts(advisories: DriftRecord["advisories"]) {
  if (!advisories) return null;
  return {
    published: advisories.published,
    since_fork_release: advisories.since_fork_release,
    severe_since_fork_release: advisories.severe_since_fork_release ?? null,
    since_our_code: advisories.since_our_code ?? null,
    severe_since_our_code: advisories.severe_since_our_code ?? null,
    affecting_fork_release: advisories.affecting_fork_release ?? null,
    severe_affecting_fork_release: advisories.severe_affecting_fork_release ?? null,
    base_release: advisories.base_release ?? null,
  };
}

function projectDriftDetail(drift: DriftRecord | undefined) {
  if (!drift) return { status: null, advisories: null };
  return {
    status: drift.status,
    status_basis: drift.status_basis ?? null,
    release_gap: drift.release_gap ?? null,
    ahead_by: drift.ahead_by,
    behind_by: drift.behind_by,
    behind_release: drift.behind_release ?? null,
    ahead_release: drift.ahead_release ?? null,
    last_upstream_merge: drift.last_upstream_merge,
    days_since_upstream_merge: drift.days_since_upstream_merge,
    fork_release: drift.fork_release ?? null,
    release_candidate: drift.release_candidate ?? null,
    upstream_release: drift.upstream_release ?? null,
    release_lag: drift.release_lag ?? null,
    licence_watch: drift.licence_watch ?? null,
    exploitability: drift.exploitability ?? null,
    upstream_health: drift.upstream_health ?? null,
    advisories: projectAdvisoryCounts(drift.advisories),
  };
}

export function projectApp(app: AppRecord, drift: DriftRecord | undefined) {
  return {
    repo: app.repo,
    class: app.class,
    url: app.url,
    description: truncate(app.description, DESCRIPTION_LIMIT),
    licence: app.licence,
    licence_note: app.licence_note ?? null,
    upstream: app.upstream,
    upstream_url: app.upstream_url,
    upstream_branch: app.upstream_branch,
    production_branch: app.production_branch,
    purpose: app.purpose,
    what_we_changed: truncate(app.what_we_changed, DESCRIPTION_LIMIT),
    mcp_server: app.mcp_server ?? null,
    sso: app.sso ?? null,
    e2e: app.e2e ?? null,
    runbook_url: app.runbook_url ?? null,
    pushed_at: app.pushed_at,
    open_pull_requests: app.open_pull_requests ?? null,
    latest_tag: app.latest_tag,
    ...projectDriftDetail(drift),
  };
}

export function getApp(apps: AppsView, drift: DriftView, repo: string) {
  const app = findByRepo(apps.records, repo);
  if (!app) return undefined;
  return projectApp(app, findByRepo(drift.records, repo));
}

function projectForecast<Forecast extends { clean: boolean; conflicted_files: string[]; conflicted_total: number }>(
  forecast: Forecast,
) {
  return {
    clean: forecast.clean,
    conflicted_total: forecast.conflicted_total,
    conflicted_files: forecast.conflicted_files.slice(0, CONFLICT_FILE_LIMIT),
  };
}

export function projectConflicts(record: ConflictRecord) {
  const head = record.against_upstream_head;
  const release = record.against_upstream_release;
  return {
    repo: record.repo,
    ...(record.error === undefined ? {} : { error: record.error }),
    against_upstream_head: head ? projectForecast(head) : null,
    against_upstream_release: release ? { tag: release.tag, ...projectForecast(release) } : null,
  };
}

export function getConflictForecast(conflicts: ConflictsView, repo: string) {
  const record = findByRepo(conflicts.records, repo);
  return record ? projectConflicts(record) : undefined;
}

type PatchItem = NonNullable<CarriedRecord["carried_items"]>[number];

function projectPatches(items: PatchItem[] | undefined) {
  return (items ?? []).slice(0, LIST_LIMIT).map((item) => ({ sha: item.sha, date: item.date, subject: truncate(item.subject, DESCRIPTION_LIMIT) }));
}

function errorField(error: string | undefined) {
  return error === undefined ? {} : { error };
}

export function projectCarried(record: CarriedRecord) {
  return {
    repo: record.repo,
    ...errorField(record.error),
    compared: record.compared ?? null,
    commits: record.commits ?? null,
    carried: record.carried ?? null,
    already_upstream: record.already_upstream ?? null,
    carried_items: projectPatches(record.carried_items),
    already_upstream_items: projectPatches(record.already_upstream_items),
  };
}

export function getCarriedPatches(carried: CarriedView, repo: string) {
  const record = findByRepo(carried.records, repo);
  return record ? projectCarried(record) : undefined;
}

type Migrations = NonNullable<UpgradeRecord["migrations"]>;
type ReleaseNotes = NonNullable<UpgradeRecord["release_notes"]>;

function projectMigrations(migrations: Migrations) {
  return {
    ours: migrations.ours,
    upstream: migrations.upstream,
    shared_dirs: migrations.shared_dirs.slice(0, LIST_LIMIT),
    sequential_dirs_count: migrations.sequential_dirs.length,
    sequential_dirs: migrations.sequential_dirs.slice(0, LIST_LIMIT),
    same_prefix_count: migrations.same_prefix.length,
    same_prefix: migrations.same_prefix.slice(0, LIST_LIMIT).map((clash) => ({
      dir: clash.dir,
      prefix: clash.prefix,
      ours: clash.ours.slice(0, LIST_LIMIT),
      upstream: clash.upstream.slice(0, LIST_LIMIT),
    })),
  };
}

function projectReleaseNotes(notes: ReleaseNotes) {
  return {
    basis: notes.basis,
    since: notes.since,
    releases: notes.releases,
    flagged: notes.flagged.slice(0, LIST_LIMIT).map((release) => ({
      tag: truncate(release.tag, DESCRIPTION_LIMIT),
      url: release.url,
      published_at: release.published_at,
      lines: release.lines.slice(0, LIST_LIMIT).map((line) => truncate(line, DESCRIPTION_LIMIT)),
    })),
  };
}

export function projectUpgradeRisk(record: UpgradeRecord) {
  return {
    repo: record.repo,
    ...errorField(record.error),
    migrations: record.migrations ? projectMigrations(record.migrations) : null,
    release_notes: record.release_notes ? projectReleaseNotes(record.release_notes) : null,
  };
}

export function getUpgradeRisk(upgrade: UpgradeView, repo: string) {
  const record = findByRepo(upgrade.records, repo);
  return record ? projectUpgradeRisk(record) : undefined;
}

function carriedSummary(record: CarriedRecord) {
  if (record.error !== undefined) return { error: record.error };
  return { compared: record.compared ?? null, commits: record.commits ?? null, carried: record.carried ?? null, already_upstream: record.already_upstream ?? null };
}

function upgradeSummary(record: UpgradeRecord) {
  if (record.error !== undefined) return { error: record.error };
  return {
    same_prefix_clashes: record.migrations?.same_prefix.length ?? null,
    sequential_dirs: record.migrations?.sequential_dirs.length ?? null,
    flagged_releases: record.release_notes?.flagged.length ?? null,
  };
}

/** A weekly view as get_app sees it: loaded, not published for the tenant, or unreachable with the reason. */
export type WeeklyView<View> = View | null | { unavailable: string };

function summarise<View extends { records: Record[] }, Record extends { repo: string }>(
  view: WeeklyView<View>,
  repo: string,
  summary: (record: Record) => unknown,
) {
  if (view === null) return null;
  if ("unavailable" in view) return { error: view.unavailable };
  const record = findByRepo(view.records, repo);
  return record ? summary(record) : null;
}

/** Counts only, so get_app can say a weekly signal has something to look at without a second call. */
export function weeklySummary(carried: WeeklyView<CarriedView>, upgrade: WeeklyView<UpgradeView>, repo: string) {
  return {
    carried_patches: summarise(carried, repo, carriedSummary),
    upgrade_risk: summarise(upgrade, repo, upgradeSummary),
  };
}

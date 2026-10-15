import type { View } from "../../../web/src/data/schemas.ts";
import { truncate } from "../text.ts";

type RepoRecord = View<"repos">["records"][number];
type CheckRecord = View<"checks">["records"][number];

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 50;
const OVERVIEW_TOP_FAILING = 10;
const OVERVIEW_MOVERS = 10;
const VALID_CHECK_NAMES_SHOWN = 30;
const FREE_TEXT_MAX = 300;

export interface Page {
  page: number;
  page_size: number;
}

export interface Paged<T> extends Page {
  total: number;
  records: T[];
}

export interface RepoFilters {
  letter?: string;
  tier?: string;
  failing_check?: string;
  owner?: string;
  min_score?: number;
  max_score?: number;
  sort?: "score" | "name" | "last_push";
}

const sameText = (left: string, right: string): boolean => left.toLowerCase() === right.toLowerCase();

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export function paginate<T>(items: readonly T[], { page, page_size }: Page): Paged<T> {
  const start = (page - 1) * page_size;
  return { total: items.length, page, page_size, records: items.slice(start, start + page_size) };
}

export function projectOverview(view: View<"overview">) {
  return {
    kpis: view.kpis,
    kpi_deltas: view.kpi_deltas,
    kpi_baseline_date: view.kpi_baseline_date,
    avg_letter: view.avg_letter,
    grade_mix: view.grade_mix,
    top_failing: view.top_failing.slice(0, OVERVIEW_TOP_FAILING),
    movers: {
      gainers: view.gainers.slice(0, OVERVIEW_MOVERS),
      losers: view.losers.slice(0, OVERVIEW_MOVERS),
    },
    movers_from: view.movers_from,
    movers_to: view.movers_to,
  };
}

export function ownerName(repo: RepoRecord): string | null {
  return (
    textOrNull(repo["ownership.owner_name"]) ?? textOrNull(repo["ownership.owner"]) ?? repo.owner_handles[0] ?? null
  );
}

function ownerAliases(repo: RepoRecord): string[] {
  const named = [textOrNull(repo["ownership.owner_name"]), textOrNull(repo["ownership.owner"])];
  return [...named, ...repo.owner_handles].filter((alias): alias is string => alias !== null);
}

export function failingChecks(repo: RepoRecord): string[] {
  return Object.entries(repo.checks)
    .filter(([, state]) => state === "fail")
    .map(([check]) => check);
}

function countState(repo: RepoRecord, wanted: string): number {
  return Object.values(repo.checks).filter((state) => state === wanted).length;
}

function lastPush(repo: RepoRecord): string | null {
  return repo["github.last_push"] ?? null;
}

function failsCheck(repo: RepoRecord, name: string): boolean {
  return Object.entries(repo.checks).some(([check, value]) => sameText(check, name) && value === "fail");
}

function matchesFilters(repo: RepoRecord, filters: RepoFilters): boolean {
  const { letter, tier, failing_check, owner, min_score, max_score } = filters;
  if (letter !== undefined && repo.score_letter !== letter) return false;
  if (tier !== undefined && !sameText(repo.repo_tier ?? "", tier)) return false;
  if (failing_check !== undefined && !failsCheck(repo, failing_check)) return false;
  if (owner !== undefined && !ownerAliases(repo).some((alias) => sameText(alias, owner))) return false;
  if (min_score !== undefined && repo.score_composite < min_score) return false;
  if (max_score !== undefined && repo.score_composite > max_score) return false;
  return true;
}

function compareByLastPush(left: RepoRecord, right: RepoRecord): number {
  const leftPush = lastPush(left);
  const rightPush = lastPush(right);
  if (leftPush === rightPush) return 0;
  if (leftPush === null) return 1;
  if (rightPush === null) return -1;
  return rightPush.localeCompare(leftPush);
}

const SORTERS: Record<NonNullable<RepoFilters["sort"]>, (left: RepoRecord, right: RepoRecord) => number> = {
  score: (left, right) => right.score_composite - left.score_composite,
  name: (left, right) => left.repo_name.localeCompare(right.repo_name),
  last_push: compareByLastPush,
};

function summarizeRepo(repo: RepoRecord) {
  return {
    repo_name: repo.repo_name,
    score_composite: repo.score_composite,
    score_letter: repo.score_letter,
    repo_tier: repo.repo_tier ?? null,
    failing_count: countState(repo, "fail"),
    last_push: lastPush(repo),
    owner: ownerName(repo),
  };
}

export function listRepos(view: View<"repos">, filters: RepoFilters, page: Page) {
  const sorter = SORTERS[filters.sort ?? "score"];
  const matching = view.records.filter((repo) => matchesFilters(repo, filters)).toSorted(sorter);
  const paged = paginate(matching, page);
  return { ...paged, records: paged.records.map(summarizeRepo) };
}

export function findRepo(view: View<"repos">, name: string): RepoRecord | null {
  const wanted = name.trim();
  const exact = view.records.find((repo) => sameText(repo.repo_name, wanted));
  if (exact) return exact;
  const bySuffix = view.records.find((repo) => sameText(repo.repo_name.split("/").slice(1).join("/"), wanted));
  return bySuffix ?? null;
}

function ownershipDetails(repo: RepoRecord) {
  return {
    handles: repo.owner_handles,
    name: textOrNull(repo["ownership.owner_name"]),
    lifecycle: textOrNull(repo["ownership.lifecycle"]),
    release: textOrNull(repo["ownership.release"]),
    theme: textOrNull(repo["ownership.theme"]),
    squad: textOrNull(repo["ownership.squad"]),
  };
}

function describeFailingCheck(check: string, checks: ReadonlyMap<string, CheckRecord>) {
  const record = checks.get(check);
  return {
    check,
    title: record?.title ?? check,
    category: record?.category ?? null,
    has_remediation: record?.has_remediation ?? false,
  };
}

export function projectRepo(repo: RepoRecord, checksView: View<"checks">) {
  const checks = new Map(checksView.records.map((record) => [record.check, record]));
  return {
    repo_name: repo.repo_name,
    score_composite: repo.score_composite,
    score_letter: repo.score_letter,
    repo_tier: repo.repo_tier ?? null,
    subscores: { structural: repo.score_structural ?? null, activity: repo.score_activity ?? null },
    last_push: lastPush(repo),
    owners: ownershipDetails(repo),
    failing_checks: failingChecks(repo).map((check) => describeFailingCheck(check, checks)),
    passing_count: countState(repo, "pass"),
    unknown_count: countState(repo, "unknown"),
  };
}

function describeCheckDescription(description: CheckRecord["description"]) {
  if (description === null) return null;
  const text = description["description"];
  return truncate(typeof text === "string" ? text : null, FREE_TEXT_MAX);
}

export function findCheck(view: View<"checks">, name: string): CheckRecord | null {
  return view.records.find((record) => sameText(record.check, name.trim())) ?? null;
}

export function validCheckNames(view: View<"checks">): string[] {
  return view.records.map((record) => record.check).slice(0, VALID_CHECK_NAMES_SHOWN);
}

export function projectCheck(record: CheckRecord) {
  const { remediation, pr_template } = record;
  return {
    check: record.check,
    title: record.title,
    category: record.category,
    description: describeCheckDescription(record.description),
    populated_pct: record.populated_pct,
    pass_pct: record.pass_pct,
    scored_by: record.scored_by?.metric ?? null,
    has_remediation: record.has_remediation,
    ...(remediation && {
      remediation: {
        title: remediation.title,
        description: remediation.description,
        source_url: remediation.source_url,
        snippet: remediation.snippet,
        issue_body: remediation.issue_body,
      },
    }),
    ...(pr_template && { pr_template }),
  };
}

export function projectAttention(view: View<"attention">, page: Page) {
  const paged = paginate(view.records, page);
  return {
    ...paged,
    records: paged.records.map(({ repo_name, repo_tier, score_composite, score_letter, reasons }) => ({
      repo_name,
      repo_tier,
      score_composite,
      score_letter,
      reasons,
    })),
  };
}

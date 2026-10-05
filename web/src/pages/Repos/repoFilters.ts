import { GRADE_ORDER, isGrade, type Grade } from "../../components/GradePill";
import { splitRepoName } from "../../components/RepoName";
import type { ReposView } from "../../data/schemas";
import { rankSearchables, type Searchable } from "../../search/match";

export type RepoRow = ReposView["records"][number];

export const PARAMS = {
  query: "q",
  grade: "grade",
  tier: "tier",
  owner: "owner",
  lifecycle: "lifecycle",
  fails: "fails",
  watched: "watched",
  sort: "sort",
  direction: "dir",
  page: "page",
} as const;

export const FILTER_PARAMS = [
  PARAMS.query,
  PARAMS.grade,
  PARAMS.tier,
  PARAMS.owner,
  PARAMS.lifecycle,
  PARAMS.fails,
  PARAMS.watched,
] as const;

export const FACET_FIELDS = {
  tier: "repo_tier",
  owner: "ownership.owner_name",
  lifecycle: "ownership.lifecycle",
} as const satisfies Record<string, keyof RepoRow>;

export type FacetName = keyof typeof FACET_FIELDS;

export interface ExplorerFilters {
  query: string;
  grades: readonly Grade[];
  tier: string | null;
  owner: string | null;
  lifecycle: string | null;
  fails: string | null;
  watched: boolean;
}

export function parseGrades(value: string | null): Grade[] {
  const requested = new Set((value ?? "").split(",").map((part) => part.trim().toUpperCase()));
  return GRADE_ORDER.filter((grade) => requested.has(grade));
}

export function gradesParam(grades: readonly Grade[]): string | null {
  return grades.length ? GRADE_ORDER.filter((grade) => grades.includes(grade)).join(",") : null;
}

export function toggledGrades(grades: readonly Grade[], grade: Grade): Grade[] {
  return grades.includes(grade) ? grades.filter((item) => item !== grade) : [...grades, grade];
}

export function facetValue(row: RepoRow, facet: FacetName): string | null {
  const value = row[FACET_FIELDS[facet]];
  return typeof value === "string" && value !== "" ? value : null;
}

export function facetOptions(rows: readonly RepoRow[], facet: FacetName): string[] {
  const values = new Set(rows.map((row) => facetValue(row, facet)).filter((value): value is string => value !== null));
  return [...values].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

function knownOrNull(value: string | null, options: readonly string[]): string | null {
  return value !== null && options.includes(value) ? value : null;
}

export interface FacetChoices {
  tier: readonly string[];
  owner: readonly string[];
  lifecycle: readonly string[];
  fails: readonly string[];
}

export function readFilters(params: URLSearchParams, choices: FacetChoices): ExplorerFilters {
  return {
    query: params.get(PARAMS.query) ?? "",
    grades: parseGrades(params.get(PARAMS.grade)),
    tier: knownOrNull(params.get(PARAMS.tier), choices.tier),
    owner: knownOrNull(params.get(PARAMS.owner), choices.owner),
    lifecycle: knownOrNull(params.get(PARAMS.lifecycle), choices.lifecycle),
    fails: knownOrNull(params.get(PARAMS.fails), choices.fails),
    watched: params.get(PARAMS.watched) === "1",
  };
}

export function hasActiveFilters(filters: ExplorerFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.grades.length > 0 ||
    [filters.tier, filters.owner, filters.lifecycle, filters.fails].some((value) => value !== null) ||
    filters.watched
  );
}

function matchesFacet(row: RepoRow, facet: FacetName, choice: string | null): boolean {
  return choice === null || facetValue(row, facet) === choice;
}

function matchesFilters(row: RepoRow, filters: ExplorerFilters, watchlist: readonly string[]): boolean {
  return (
    (filters.grades.length === 0 || (isGrade(row.score_letter) && filters.grades.includes(row.score_letter))) &&
    matchesFacet(row, "tier", filters.tier) &&
    matchesFacet(row, "owner", filters.owner) &&
    matchesFacet(row, "lifecycle", filters.lifecycle) &&
    (filters.fails === null || row.checks[filters.fails] === "fail") &&
    (!filters.watched || watchlist.includes(row.repo_name))
  );
}

interface SearchableRow extends Searchable {
  row: RepoRow;
}

function searchable(row: RepoRow): SearchableRow {
  return { row, label: row.repo_name, keys: [row.repo_name, splitRepoName(row.repo_name).short] };
}

export function searchRows(rows: readonly RepoRow[], query: string): RepoRow[] {
  if (!query.trim()) return [...rows];
  return rankSearchables(rows.map(searchable), query, rows.length).map((item) => item.row);
}

export function filterRows(rows: readonly RepoRow[], filters: ExplorerFilters, watchlist: readonly string[]): RepoRow[] {
  return searchRows(
    rows.filter((row) => matchesFilters(row, filters, watchlist)),
    filters.query,
  );
}

export function lastPushDate(row: RepoRow): string | null {
  const value = row["github.last_push"];
  return value ? value.slice(0, 10) : null;
}

export function resultsLine(shown: number, total: number): string {
  return `${shown} of ${total} ${total === 1 ? "repository" : "repositories"}`;
}

export const CLEARED_FILTERS: Record<string, null> = Object.fromEntries(
  [...FILTER_PARAMS, PARAMS.page].map((param) => [param, null]),
);

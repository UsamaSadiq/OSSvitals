import type { Column, SortState } from "../../components/DataTable";
import { GradePill, GRADE_ORDER } from "../../components/GradePill";
import { RepoLink } from "../../components/RepoName";
import { sortRows, type SortDirection } from "../../components/sortRows";
import type { CsvColumn } from "../../format/csv";
import { formatScore } from "../../format";
import { WatchButton } from "../../watchlist/WatchButton";
import { lastPushDate, PARAMS, type RepoRow } from "./repoFilters";

const NO_VALUE = "—";
const MISSING_LAST = -1;

function scoreText(value: number | null | undefined): string {
  return value === null || value === undefined ? NO_VALUE : formatScore(value);
}

function scoreSortValue(value: number | null | undefined): number {
  return value ?? MISSING_LAST;
}

export function byRepoName(a: RepoRow, b: RepoRow): number {
  if (a.repo_name === b.repo_name) return 0;
  return a.repo_name < b.repo_name ? -1 : 1;
}

export const REPO_COLUMNS: Column<RepoRow>[] = [
  {
    key: "watch",
    header: "Watch",
    cell: (row) => <WatchButton repo={row.repo_name} compact />,
  },
  {
    key: "repo",
    header: "Repository",
    cell: (row) => <RepoLink name={row.repo_name} />,
    sortValue: (row) => row.repo_name,
  },
  {
    key: "grade",
    header: "Grade",
    cell: (row) => <GradePill grade={row.score_letter} />,
    sortValue: (row) => GRADE_ORDER.indexOf(row.score_letter),
  },
  {
    key: "composite",
    header: "Composite",
    cell: (row) => formatScore(row.score_composite),
    sortValue: (row) => row.score_composite,
    numeric: true,
  },
  {
    key: "structural",
    header: "Structural",
    cell: (row) => scoreText(row.score_structural),
    sortValue: (row) => scoreSortValue(row.score_structural),
    numeric: true,
  },
  {
    key: "activity",
    header: "Activity",
    cell: (row) => scoreText(row.score_activity),
    sortValue: (row) => scoreSortValue(row.score_activity),
    numeric: true,
  },
  {
    key: "tier",
    header: "Tier",
    cell: (row) => row.repo_tier ?? NO_VALUE,
    sortValue: (row) => row.repo_tier ?? "",
  },
  {
    key: "last_push",
    header: "Last push",
    cell: (row) => lastPushDate(row) ?? NO_VALUE,
    sortValue: (row) => lastPushDate(row) ?? "",
  },
];

export const DEFAULT_SORT: SortState = { key: "composite", direction: "descending" };

const DIRECTIONS: Record<string, SortDirection> = { asc: "ascending", desc: "descending" };

export function readSort(params: URLSearchParams, hasQuery: boolean): SortState | undefined {
  const key = params.get(PARAMS.sort);
  const column = REPO_COLUMNS.find((candidate) => candidate.key === key && candidate.sortValue);
  if (!column) return hasQuery ? undefined : DEFAULT_SORT;
  const direction = DIRECTIONS[params.get(PARAMS.direction) ?? ""] ?? (column.numeric ? "descending" : "ascending");
  return { key: column.key, direction };
}

export function sortParams(sort: SortState): Record<string, string> {
  return { [PARAMS.sort]: sort.key, [PARAMS.direction]: sort.direction === "ascending" ? "asc" : "desc" };
}

export function sortedRepos(rows: readonly RepoRow[], sort: SortState | undefined): RepoRow[] {
  const sortValue = REPO_COLUMNS.find((column) => column.key === sort?.key)?.sortValue;
  if (!sort || !sortValue) return [...rows];
  return sortRows(rows, sortValue, sort.direction, byRepoName);
}

export const CSV_COLUMNS: CsvColumn<RepoRow>[] = [
  { header: "repo_name", value: (row) => row.repo_name },
  { header: "score_letter", value: (row) => row.score_letter },
  { header: "score_composite", value: (row) => row.score_composite },
  { header: "score_structural", value: (row) => row.score_structural },
  { header: "score_activity", value: (row) => row.score_activity },
  { header: "repo_tier", value: (row) => row.repo_tier },
  { header: "github.last_push", value: (row) => row["github.last_push"] },
];

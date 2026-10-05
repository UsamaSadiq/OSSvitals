import type { ComponentsView } from "../../data/schemas";

export type ComponentRow = NonNullable<ComponentsView["components"]>[number];
export type FindingRow = NonNullable<ComponentsView["findings"]>[number];
export type FindingRepo = FindingRow["repos"][number];
export type RelationRow = NonNullable<ComponentsView["relations"]>[number];
export type Summary = NonNullable<ComponentsView["summary"]>;

export const ALL = "All";
export const IN_RELEASE = "In a named release";
export const NOT_IN_RELEASE = "Not in a release";
export const RELEASE_OPTIONS = [ALL, IN_RELEASE, NOT_IN_RELEASE] as const;

export interface ComponentFilters {
  type: string;
  lifecycle: string;
  release: string;
}

export function collectedLabel(collectedAt: string | null | undefined): string {
  return `${(collectedAt ?? "").slice(0, 16).replace("T", " ")} UTC`;
}

export function filterOptions(values: readonly (string | null | undefined)[]): string[] {
  const distinct = new Set(values.filter((value): value is string => Boolean(value)));
  return [ALL, ...[...distinct].sort()];
}

export function declaredComponents(rows: readonly ComponentRow[]): ComponentRow[] {
  return rows.filter((row) => row.has_file);
}

function isInRelease(row: ComponentRow): boolean {
  return Boolean(row.release);
}

function matchesChoice(value: string | null | undefined, choice: string): boolean {
  return choice === ALL || value === choice;
}

function matchesRelease(row: ComponentRow, choice: string): boolean {
  if (choice === ALL) return true;
  return isInRelease(row) === (choice === IN_RELEASE);
}

export function filterComponents(rows: readonly ComponentRow[], filters: ComponentFilters): ComponentRow[] {
  return rows.filter(
    (row) =>
      matchesChoice(row.type, filters.type) &&
      matchesChoice(row.lifecycle, filters.lifecycle) &&
      matchesRelease(row, filters.release),
  );
}

export function releaseLabel(release: string | null | undefined): string {
  return release || "no";
}

export type FindingKind = "problem" | "note";

export function findingKind(finding: FindingRow): FindingKind {
  return finding.severity === "problem" ? "problem" : "note";
}

export const FINDING_KIND_LABELS: Record<FindingKind, string> = { problem: "Problem", note: "Note" };

export function repoNoun(count: number): string {
  return count === 1 ? "repo" : "repos";
}

export interface RelationGroup {
  repo: string;
  relations: RelationRow[];
}

export function groupRelations(rows: readonly RelationRow[]): RelationGroup[] {
  const repos = [...new Set(rows.map((row) => row.repo_name))].sort();
  return repos.map((repo) => ({ repo, relations: rows.filter((row) => row.repo_name === repo) }));
}

export interface StatusCount {
  status: string;
  count: number;
}

export function statusCounts(rows: readonly RelationRow[]): StatusCount[] {
  const statuses = [...new Set(rows.map((row) => row.status))].sort();
  return statuses.map((status) => ({ status, count: rows.filter((row) => row.status === status).length }));
}

export function statusCountText(counts: readonly StatusCount[]): string {
  return counts.map(({ status, count }) => `${count} ${status.toLowerCase()}`).join(" · ");
}

export function relationsSummary(rows: readonly RelationRow[]): string {
  const repoCount = new Set(rows.map((row) => row.repo_name)).size;
  const relationNoun = rows.length === 1 ? "relation" : "relations";
  const repoNoun = repoCount === 1 ? "repository" : "repositories";
  return `${rows.length} ${relationNoun} across ${repoCount} ${repoNoun}: ${statusCountText(statusCounts(rows))}`;
}

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

export function findingSuffix(finding: FindingRow): string {
  const kind = finding.severity === "problem" ? "Problem" : "Note";
  return ` · ${finding.repos.length} repos · ${kind}`;
}

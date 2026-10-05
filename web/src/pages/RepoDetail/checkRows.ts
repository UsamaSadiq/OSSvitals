import type { ChecksView } from "../../data/schemas";

export type CheckRecord = ChecksView["records"][number];
export type CheckState = "pass" | "fail" | "unknown";

export const FILTER_PARAM = "filter";
export const CATEGORY_PARAM = "category";
export const FILTER_OPTIONS = ["Failing", "Passing", "Unknown", "All"] as const;
export type FilterChoice = (typeof FILTER_OPTIONS)[number];
export const DEFAULT_FILTER: FilterChoice = "Failing";
export const ALL = "All";

const STATE_FOR_FILTER: Record<FilterChoice, CheckState | null> = {
  Failing: "fail",
  Passing: "pass",
  Unknown: "unknown",
  All: null,
};

const STATE_LABELS: Record<CheckState, string> = { pass: "Pass", fail: "Fail", unknown: "Unknown" };

export interface CheckRow {
  record: CheckRecord;
  category: string;
  state: CheckState;
  value: string | null;
}

function byCheckName(a: CheckRow, b: CheckRow): number {
  if (a.record.check === b.record.check) return 0;
  return a.record.check < b.record.check ? -1 : 1;
}

export function checkRows(
  records: readonly CheckRecord[],
  rawValues: Record<string, string | null>,
  states: Record<string, CheckState>,
): CheckRow[] {
  return records
    .flatMap((record) =>
      record.category !== null && record.check in rawValues
        ? [{ record, category: record.category, state: states[record.check] ?? "unknown", value: rawValues[record.check] ?? null }]
        : [],
    )
    .sort(byCheckName);
}

export function categoryOptions(cardNames: readonly string[], rows: readonly CheckRow[]): string[] {
  return [ALL, ...cardNames.filter((name) => rows.some((row) => row.category === name))];
}

export function visibleRows(rows: readonly CheckRow[], filter: FilterChoice, category: string): CheckRow[] {
  const state = STATE_FOR_FILTER[filter];
  return rows.filter((row) => (category === ALL || row.category === category) && (state === null || row.state === state));
}

export function stateLabel(state: CheckState): string {
  return STATE_LABELS[state];
}

export function hasFix(row: CheckRow): boolean {
  return row.state === "fail" && row.record.remediation !== null;
}

function matchesQuery(row: CheckRow, needle: string): boolean {
  return row.record.title.toLowerCase().includes(needle) || row.record.check.toLowerCase().includes(needle);
}

export function searchChecks(rows: readonly CheckRow[], query: string): CheckRow[] {
  const needle = query.trim().toLowerCase();
  return needle ? rows.filter((row) => matchesQuery(row, needle)) : [...rows];
}

export interface CheckGroup {
  category: string;
  rows: CheckRow[];
}

export function groupByCategory(rows: readonly CheckRow[], order: readonly string[]): CheckGroup[] {
  const unlisted = rows.map((row) => row.category).filter((category) => !order.includes(category));
  return [...new Set([...order, ...unlisted])]
    .filter((category) => category !== ALL)
    .map((category) => ({ category, rows: rows.filter((row) => row.category === category) }))
    .filter((group) => group.rows.length > 0);
}

export function descriptionText(record: CheckRecord): string {
  const text = record.description?.description;
  return typeof text === "string" ? text : "No description available.";
}

export function shownCaption(shown: number, total: number): string {
  return `${shown} of ${total} checks shown.`;
}

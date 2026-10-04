import type { ChecksView } from "../../data/schemas";
import { formatPercent, formatUtcDate, toFixedHalfEven } from "../../format";

export type CheckRecord = ChecksView["records"][number];
type ReviewWindow = ChecksView["review_window"];

export const NO_VALUE = "—";

export interface CheckGroup {
  name: string;
  checks: CheckRecord[];
}

export interface ScoreLine {
  metric: string;
  weightPct: string;
  computable: boolean;
}

export interface MetaPart {
  label: string;
  href?: string;
}

export interface SaturatedRow {
  check: string;
  dominant: string;
  sharePct: number | null;
  outliers: number | null;
}

export interface SparseRow {
  check: string;
  fillPct: number | null;
}

export interface Candidate {
  name: string;
  rationale: string;
  feasibility: string | null;
  chaossMetric: string | null;
  scorecardCheck: string | null;
}

export interface CandidateBuckets {
  proposed: Candidate[];
  phase2: Candidate[];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

export function formatPct(value: number | null): string {
  return value === null ? NO_VALUE : `${toFixedHalfEven(value, 1)}%`;
}

export function formatThreshold(fraction: number | undefined): string {
  return fraction === undefined ? NO_VALUE : formatPercent(fraction, 0);
}

export function descriptionText(record: CheckRecord): string | null {
  return text(record.description?.description);
}

export function scoreLine(record: CheckRecord): ScoreLine | null {
  const score = record.scored_by;
  if (!score) return null;
  const weight = numberOrNull(score.weight_pct);
  return {
    metric: score.metric,
    weightPct: weight === null ? NO_VALUE : toFixedHalfEven(weight, 1),
    computable: score.status === "computable",
  };
}

export function metaParts(record: CheckRecord): MetaPart[] {
  const info = record.description ?? {};
  const chaoss = text(info.chaoss_metric);
  const scorecard = text(info.scorecard_check);
  const source = text(info.source_url);
  return [
    ...(chaoss ? [{ label: `CHAOSS: ${chaoss}` }] : []),
    ...(scorecard ? [{ label: `Scorecard: ${scorecard}` }] : []),
    ...(source ? [{ label: "Source", href: source }] : []),
  ];
}

export function configGaps(record: CheckRecord): string[] {
  return [
    ...(record.description === null ? ["missing description"] : []),
    ...(record.has_remediation ? [] : ["no remediation entry"]),
  ];
}

export function countScored(records: readonly CheckRecord[]): number {
  return records.filter((record) => record.scored_by !== null).length;
}

export function countMissingDescriptions(records: readonly CheckRecord[]): number {
  return records.filter((record) => record.description === null).length;
}

export function groupedChecks(checks: Pick<ChecksView, "records" | "groups">): CheckGroup[] {
  const byName = new Map(checks.records.map((record) => [record.check, record]));
  return checks.groups
    .map((group) => ({ name: group.name, checks: group.checks.flatMap((name) => byName.get(name) ?? []) }))
    .filter((group) => group.checks.length > 0);
}

export function windowText(window: ReviewWindow): string {
  if (window.snapshots < 2 || !window.first || !window.last) {
    return "the latest snapshot only (no history retained yet)";
  }
  return `all ${window.snapshots} retained snapshots, ${formatUtcDate(window.first)} to ${formatUtcDate(window.last)}`;
}

type ReviewRecord = ChecksView["up_for_review"][number];

function saturatedRow(row: ReviewRecord): SaturatedRow {
  return {
    check: row.check,
    dominant: text(row.dominant) ?? "",
    sharePct: numberOrNull(row.share_pct),
    outliers: numberOrNull(row.outliers),
  };
}

function sparseRow(row: ReviewRecord): SparseRow {
  return { check: row.check, fillPct: numberOrNull(row.fill_pct) };
}

export function saturatedRows(rows: readonly ReviewRecord[]): SaturatedRow[] {
  return rows.filter((row) => row.kind === "saturated").map(saturatedRow);
}

export function sparseRows(rows: readonly ReviewRecord[]): SparseRow[] {
  return rows.filter((row) => row.kind === "sparse").map(sparseRow);
}

function candidate(raw: Record<string, unknown>): Candidate {
  return {
    name: text(raw.name) ?? "",
    rationale: text(raw.rationale) ?? "",
    feasibility: text(raw.feasibility),
    chaossMetric: text(raw.chaoss_metric),
    scorecardCheck: text(raw.scorecard_check),
  };
}

function withStatus(candidates: ChecksView["candidates"], status: string): Candidate[] {
  return candidates.filter((raw) => raw.status === status).map(candidate);
}

export function candidateBuckets(candidates: ChecksView["candidates"]): CandidateBuckets {
  return { proposed: withStatus(candidates, "proposed"), phase2: withStatus(candidates, "phase-2") };
}

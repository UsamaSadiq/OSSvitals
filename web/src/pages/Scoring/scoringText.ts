import { toFixedHalfEven } from "../../format";
import type { ScoringView } from "../../data/schemas";

export type MetricRow = ScoringView["metrics"][number];
export type Proposed = NonNullable<ScoringView["proposed"]>;
export type SwapRow = Proposed["swaps"][number];
export type ChangeRow = Proposed["changes"][number];

export const SCORES_FILE_URL = "https://github.com/UsamaSadiq/OSSvitals/blob/data/openedx/scores.json";

export function formatWholePercent(value: number | null): string {
  return value === null ? "" : `${toFixedHalfEven(value, 0)}%`;
}

export function formatSignedChange(value: number): string {
  const text = toFixedHalfEven(value, 1);
  return text.startsWith("-") ? text : `+${text}`;
}

export function missingDefaults(rows: readonly MetricRow[]): string {
  const distinct = [...new Set(rows.map((row) => row.missing_scores_as))];
  return distinct.sort((a, b) => a - b).join(", ");
}

export function limitedRows(rows: readonly MetricRow[]): MetricRow[] {
  return rows.filter((row) => row.limitation !== "");
}

export function provisionalMetrics(rows: readonly MetricRow[]): string[] {
  return rows.filter((row) => row.provisional).map((row) => row.metric);
}

export function pendingSwaps(swaps: readonly SwapRow[]): SwapRow[] {
  return swaps.filter((row) => !row.in_snapshot);
}

export function versionText(version: string | null): string {
  return version ?? "unknown";
}

import { formatNumber, formatPercent, formatUtcDate } from "../../format";

export const DIRECTIONAL_THRESHOLD = 0.8;
export const SPARKLINE_DAYS = 30;

const TOTAL_NOUNS: Record<string, string> = {
  "github.issues_open": "open issues",
  "github.prs_open": "open PRs",
  "github.first_timer_prs_90d": "first-timer PRs in 90 days",
  ci_failing_repos: "repos with failing default-branch CI",
};

export function isDirectional(measuredWeight: number): boolean {
  return measuredWeight < DIRECTIONAL_THRESHOLD;
}

export function directionalDetail(measuredWeight: number, unavailableMetrics: readonly string[]): string {
  const missing = unavailableMetrics.length ? unavailableMetrics.join(", ") : "unknown";
  return (
    `Only ${formatPercent(measuredWeight)} of the scoring weight can be computed from this snapshot; ` +
    "the rest falls back to a fixed default of 50, which moves no repository up or down relative to any " +
    `other. Not collected: ${missing}.`
  );
}

export function activityLine(repoCount: number, totals: Record<string, number>): string | null {
  const parts = Object.entries(totals).map(([key, total]) => `${formatNumber(total)} ${TOTAL_NOUNS[key] ?? key}`);
  if (parts.length === 0) return null;
  return `Across ${formatNumber(repoCount)} repositories: ${parts.join(" · ")}`;
}

export function snapshotLabel(snapshotTimestamp: string | null): string {
  return (snapshotTimestamp && formatUtcDate(snapshotTimestamp)) || "unknown";
}

export function gaugeCaption(repoCount: number, snapshotTimestamp: string | null): string {
  return `${repoCount} repositories · snapshot ${snapshotLabel(snapshotTimestamp)} (UTC)`;
}

export function measuredHelp(averageCoverage: number): string {
  return (
    "Fraction of total metric weight computed from real values. The remainder falls back to " +
    "default_when_missing (50), so it moves no repository up or down relative to any other. " +
    `Columns present in the snapshot: ${formatPercent(averageCoverage)}.`
  );
}

export function moversCaption(from: string | null, to: string | null): string {
  const span = from && to ? `${formatUtcDate(from)} → ${formatUtcDate(to)}` : "available history";
  return `Composite score change · ${span} (UTC)`;
}

export function formatScoreChange(delta: number): string {
  const text = delta.toFixed(1);
  return delta > 0 ? `+${text}` : text;
}

export function fullTableTitle(repoCount: number): string {
  return `Full table — ${repoCount} repos`;
}

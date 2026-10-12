import { appsPath } from "./paths";
import type { AppRecord, DriftRecord } from "./schemas";

export const STATUS_ORDER = ["in-sync", "lagging", "stale", "critical"] as const;

export type Status = (typeof STATUS_ORDER)[number];

export const STATUS_LABELS: Record<Status, string> = {
  "in-sync": "In sync",
  lagging: "Lagging",
  stale: "Stale",
  critical: "Critical",
};

export interface ForkRow {
  app: AppRecord;
  drift: DriftRecord;
}

export function isStatus(value: string): value is Status {
  return (STATUS_ORDER as readonly string[]).includes(value);
}

export function forkRows(apps: readonly AppRecord[], drift: readonly DriftRecord[]): ForkRow[] {
  const byRepo = new Map(drift.map((record) => [record.repo, record]));
  return apps.flatMap((app) => {
    const record = byRepo.get(app.repo);
    return app.class === "fork" && record ? [{ app, drift: record }] : [];
  });
}

export function statusCounts(rows: readonly ForkRow[]): Record<Status, number> {
  const counts: Record<Status, number> = { "in-sync": 0, lagging: 0, stale: 0, critical: 0 };
  for (const row of rows) if (isStatus(row.drift.status)) counts[row.drift.status] += 1;
  return counts;
}

export function severity(status: string): number {
  return isStatus(status) ? STATUS_ORDER.indexOf(status) : -1;
}

export function formatDay(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "–";
}

export function sortedForks(rows: readonly ForkRow[]): ForkRow[] {
  return [...rows].sort((a, b) => severity(b.drift.status) - severity(a.drift.status) || b.drift.behind_by - a.drift.behind_by);
}

export function pluralise(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

export interface OverviewStat {
  key: string;
  label: string;
  count: number;
  to: string;
}

export interface OverviewStats {
  total: OverviewStat;
  statuses: OverviewStat[];
  extras: OverviewStat[];
  licences: OverviewStat[];
  originals: OverviewStat;
}

export function overviewStats(forks: readonly ForkRow[], originals: number): OverviewStats {
  const counts = statusCounts(forks);
  const licences = [...new Set(forks.flatMap((row) => (row.app.licence ? [row.app.licence] : [])))].sort((a, b) => a.localeCompare(b));
  return {
    total: { key: "total", label: "Forks tracked", count: forks.length, to: appsPath() },
    statuses: STATUS_ORDER.map((status) => ({ key: status, label: STATUS_LABELS[status], count: counts[status], to: appsPath({ status }) })),
    extras: [
      {
        key: "advisories",
        label: "With new advisories",
        count: forks.filter((row) => row.drift.advisories.since_fork_release > 0).length,
        to: appsPath({ advisories: "1" }),
      },
      {
        key: "unpromoted",
        label: "Not yet promoted",
        count: forks.filter((row) => (row.drift.promotion?.unpromoted_commits ?? 0) > 0).length,
        to: appsPath({ unpromoted: "1" }),
      },
      { key: "no-release", label: "No release yet", count: forks.filter((row) => row.drift.fork_release === null).length, to: appsPath({ no_release: "1" }) },
    ],
    licences: licences.map((licence) => ({
      key: licence,
      label: licence,
      count: forks.filter((row) => row.app.licence === licence).length,
      to: appsPath({ licence }),
    })),
    originals: { key: "originals", label: "Original projects", count: originals, to: `${appsPath()}#originals` },
  };
}

const ATTENTION_STATUSES: readonly Status[] = ["critical", "stale"];

export function needingAttention(forks: readonly ForkRow[]): ForkRow[] {
  return sortedForks(forks).filter((row) => ATTENTION_STATUSES.some((status) => status === row.drift.status));
}

export function advisoryLabel(count: number): string {
  return `${count} new upstream ${count === 1 ? "advisory" : "advisories"}`;
}

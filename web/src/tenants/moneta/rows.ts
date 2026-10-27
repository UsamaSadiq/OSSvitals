import { appsPath } from "./paths";
import type { AppRecord, DriftRecord, ReleaseGap } from "./schemas";

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

export function byDrift(a: ForkRow, b: ForkRow): number {
  return (b.drift.release_gap?.releases_behind ?? 0) - (a.drift.release_gap?.releases_behind ?? 0) || b.drift.behind_by - a.drift.behind_by;
}

export function sortedForks(rows: readonly ForkRow[]): ForkRow[] {
  return [...rows].sort((a, b) => severity(b.drift.status) - severity(a.drift.status) || byDrift(a, b));
}

export function pluralise(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

const GAP_TEXT: Record<ReleaseGap["level"], string> = {
  none: "on the latest release",
  patch: "patch releases only",
  minor: "a minor version behind",
  major: "a major version behind",
};

export function releaseGapText(gap: ReleaseGap): string {
  if (gap.releases_behind === 0) return `${gap.base}, upstream's latest release`;
  return `${gap.base} → ${gap.latest}, ${pluralise(gap.releases_behind, "release")} behind (${GAP_TEXT[gap.level]})`;
}

export interface DriftHeadline {
  count: number;
  text: string;
}

export function driftHeadline(drift: DriftRecord): DriftHeadline {
  const gap = drift.release_gap;
  if (gap?.releases_behind === 0) return { count: 0, text: `releases behind (on upstream's latest, ${gap.base})` };
  if (gap) return { count: gap.releases_behind, text: `${gap.releases_behind === 1 ? "release" : "releases"} behind upstream (${gap.base} → ${gap.latest})` };
  return { count: drift.behind_by, text: `${drift.behind_by === 1 ? "commit" : "commits"} behind upstream` };
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

export function advisoryNotice(drift: DriftRecord): string | null {
  const { advisories, release_gap: gap } = drift;
  if (gap && drift.status_basis === "release") {
    const affecting = advisories.affecting_fork_release ?? 0;
    return affecting > 0 ? `${affecting} upstream ${affecting === 1 ? "advisory affects" : "advisories affect"} ${gap.base}, our base` : null;
  }
  return advisories.since_fork_release > 0 ? `${advisoryLabel(advisories.since_fork_release)} since our latest release` : null;
}

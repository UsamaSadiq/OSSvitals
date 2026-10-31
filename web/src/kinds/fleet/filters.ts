import { isStatus, statusCounts, type ForkRow, type Status } from "./rows";
import type { SignalKey } from "./signals";

export const PARAMS = {
  status: "status",
  licence: "licence",
  advisories: "advisories",
  noRelease: "no_release",
  unpromoted: "unpromoted",
  app: "app",
} as const;

export const FILTER_PARAMS = Object.values(PARAMS);

export interface ForkFilters {
  statuses: readonly Status[];
  licence: string | null;
  advisories: boolean;
  noRelease: boolean;
  unpromoted: boolean;
  app: string | null;
}

export function parseFilters(params: URLSearchParams): ForkFilters {
  return {
    statuses: (params.get(PARAMS.status) ?? "").split(",").filter(isStatus),
    licence: params.get(PARAMS.licence) || null,
    advisories: params.get(PARAMS.advisories) === "1",
    noRelease: params.get(PARAMS.noRelease) === "1",
    unpromoted: params.get(PARAMS.unpromoted) === "1",
    app: params.get(PARAMS.app) || null,
  };
}

const SIGNAL_OF_FLAG = { advisories: "advisories", noRelease: "fork_release", unpromoted: "promotion" } as const satisfies Record<string, SignalKey>;

/** A filter for a signal that is not shown is ignored, even if a shared link still carries it. */
export function withoutHiddenFilters(filters: ForkFilters, isShown: (key: SignalKey) => boolean): ForkFilters {
  return {
    ...filters,
    advisories: filters.advisories && isShown(SIGNAL_OF_FLAG.advisories),
    noRelease: filters.noRelease && isShown(SIGNAL_OF_FLAG.noRelease),
    unpromoted: filters.unpromoted && isShown(SIGNAL_OF_FLAG.unpromoted),
  };
}

export function hasActiveFilters(filters: ForkFilters): boolean {
  return filters.statuses.length > 0 || filters.licence !== null || filters.advisories || filters.noRelease || filters.unpromoted || filters.app !== null;
}

export function toggledStatuses(current: readonly Status[], status: Status): Status[] {
  return current.includes(status) ? current.filter((existing) => existing !== status) : [...current, status];
}

function matches(row: ForkRow, filters: ForkFilters): boolean {
  const { drift, app } = row;
  return (
    (filters.statuses.length === 0 || filters.statuses.some((status) => status === drift.status)) &&
    (filters.licence === null || app.licence === filters.licence) &&
    (!filters.advisories || (drift.advisories?.since_fork_release ?? 0) > 0) &&
    (!filters.noRelease || drift.fork_release === null) &&
    (!filters.unpromoted || (drift.promotion?.unpromoted_commits ?? 0) > 0) &&
    (filters.app === null || app.repo === filters.app)
  );
}

export function applyFilters(rows: readonly ForkRow[], filters: ForkFilters): ForkRow[] {
  return rows.filter((row) => matches(row, filters));
}

export function countsIgnoringStatus(rows: readonly ForkRow[], filters: ForkFilters): Record<Status, number> {
  return statusCounts(applyFilters(rows, { ...filters, statuses: [] }));
}

export function appOptions(rows: readonly ForkRow[]): string[] {
  return rows.map((row) => row.app.repo).sort((a, b) => a.localeCompare(b));
}

export function licenceOptions(rows: readonly ForkRow[]): string[] {
  const licences = rows.flatMap((row) => (row.app.licence ? [row.app.licence] : []));
  return [...new Set(licences)].sort((a, b) => a.localeCompare(b));
}

import { advisoryNotice, pluralise, releaseGapText, type ForkRow } from "./rows";
import type { ConflictRecord, HistoryRow } from "./schemas";
import type { SignalKey } from "./signals";
import { exploitedNotice } from "./exploited";
import { licenceNotice } from "./licence";

export interface StatusChange {
  date: string;
  repo: string;
  from: string;
  to: string;
}

export interface TrendPoint {
  date: string;
  behind: number;
}

const byDate = (a: HistoryRow, b: HistoryRow) => a.date.localeCompare(b.date);

function groupByRepo(rows: readonly HistoryRow[]): Map<string, HistoryRow[]> {
  const groups = new Map<string, HistoryRow[]>();
  for (const row of [...rows].sort(byDate)) groups.set(row.repo, [...(groups.get(row.repo) ?? []), row]);
  return groups;
}

export function statusChanges(history: readonly HistoryRow[], limit: number): StatusChange[] {
  const changes = [...groupByRepo(history).values()].flatMap((rows) =>
    rows.flatMap((row, index) => {
      const previous = rows[index - 1];
      return previous && previous.status !== row.status ? [{ date: row.date, repo: row.repo, from: previous.status, to: row.status }] : [];
    }),
  );
  return changes.sort((a, b) => b.date.localeCompare(a.date) || a.repo.localeCompare(b.repo)).slice(0, limit);
}

export function trendOf(history: readonly HistoryRow[], repo: string): TrendPoint[] {
  return history
    .filter((row) => row.repo === repo)
    .sort(byDate)
    .map((row) => ({ date: row.date, behind: row.behind_by }));
}

export function sparklinePoints(values: readonly number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((value, index) => `${(index * step).toFixed(1)},${(height - ((value - low) / span) * height).toFixed(1)}`).join(" ");
}

export function trendDirection(points: readonly TrendPoint[]): "falling-behind" | "catching-up" | "steady" | "unknown" {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return "unknown";
  if (last.behind > first.behind) return "falling-behind";
  if (last.behind < first.behind) return "catching-up";
  return "steady";
}

export function attentionReasons(row: ForkRow, conflict: ConflictRecord | undefined, isShown: (key: SignalKey) => boolean = () => true): string[] {
  const { drift } = row;
  const conflicts = conflict?.against_upstream_head;
  const gap = isShown("release_gap") ? drift.release_gap : null;
  const reasons = [
    gap ? `Built on ${releaseGapText(gap)}` : `${pluralise(drift.behind_by, "commit")} behind upstream, last synced ${drift.days_since_upstream_merge} days ago`,
    isShown("advisories") ? advisoryNotice(drift, isShown("release_gap")) : null,
    isShown("ci") && drift.ci?.state === "failing" ? "Checks are failing on our release branch" : null,
    isShown("fork_release") && drift.fork_release === null ? "We have not cut a release of our own yet" : null,
    isShown("conflicts") && conflicts && !conflicts.clean ? `Syncing with upstream would conflict on ${pluralise(conflicts.conflicted_total, "file")}` : null,
    isShown("upstream_activity") && drift.upstream_activity?.quiet ? "Upstream has gone quiet" : null,
    isShown("licence_watch") ? licenceNotice(drift.licence_watch) : null,
    isShown("exploitability") ? exploitedNotice(drift.exploitability) : null,
  ];
  return reasons.filter((reason): reason is string => reason !== null);
}

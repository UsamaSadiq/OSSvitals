import type { HistoryView, ReposView } from "../data/schemas";

type RepoRecord = ReposView["records"][number];
type HistoryPoint = HistoryView["repos"][string][number];

const DAY_MS = 24 * 60 * 60 * 1000;

export interface WatchRow {
  repo: string;
  record: RepoRecord | null;
  delta: number | null;
}

function scoredPoints(points: readonly HistoryPoint[]): [string, number][] {
  return points.flatMap(([date, score]) => (score === null ? [] : [[date, score] as [string, number]]));
}

export function baselineScore(points: readonly HistoryPoint[], days: number): number | null {
  const scored = scoredPoints(points);
  const last = scored.at(-1);
  if (!last) return null;
  const cutoff = Date.parse(last[0]) - days * DAY_MS;
  const baseline = scored.find(([date]) => Date.parse(date) >= cutoff);
  return baseline && baseline[0] !== last[0] ? baseline[1] : null;
}

export function scoreDelta(current: number, points: readonly HistoryPoint[] | undefined, days: number): number | null {
  const baseline = points ? baselineScore(points, days) : null;
  return baseline === null ? null : current - baseline;
}

export function watchRows(
  watchlist: readonly string[],
  records: readonly RepoRecord[],
  history: HistoryView["repos"] | undefined,
  days: number,
): WatchRow[] {
  const byName = new Map(records.map((record) => [record.repo_name, record]));
  return watchlist.map((repo) => {
    const record = byName.get(repo) ?? null;
    return { repo, record, delta: record ? scoreDelta(record.score_composite, history?.[repo], days) : null };
  });
}

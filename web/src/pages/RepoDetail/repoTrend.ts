import { lastDays, trendSparkline, type Chart, type SeriesPoint } from "../../components/charts";
import { kpiDelta, type KpiDelta } from "../../components/kpiDelta";
import type { HistoryView } from "../../data/schemas";

export const TREND_DAYS = 30;

export type HistoryPoint = HistoryView["repos"][string][number];

export interface RepoTrend {
  chart: Chart;
  delta: KpiDelta;
  since: string;
}

export function compositeSeries(points: readonly HistoryPoint[] | undefined): SeriesPoint[] {
  return (points ?? []).flatMap(([date, composite]) => (composite === null ? [] : [[date, composite] as const]));
}

export function repoTrend(points: readonly HistoryPoint[] | undefined, days = TREND_DAYS): RepoTrend | null {
  const series = lastDays(compositeSeries(points), days);
  const first = series[0];
  const last = series.at(-1);
  const chart = trendSparkline(series, { subject: "Composite score", tipLabel: "Composite", summary: null });
  const delta = first && last ? kpiDelta(last[1] - first[1], "float") : null;
  if (!first || !chart || !delta) return null;
  return { chart, delta, since: first[0] };
}

export function trendLabel(trend: RepoTrend): string {
  return `${trend.delta.text} since ${trend.since}`;
}

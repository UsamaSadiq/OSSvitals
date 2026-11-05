import type { Chart } from "../../components/charts";
import { tipMark } from "../../components/charts";
import { formatNumber } from "../../format";
import type { DatedCount } from "../../data/schemas";

export interface SeriesBar {
  label: string;
  value: number;
  tip: string;
}

export interface Change {
  from: DatedCount;
  to: DatedCount;
  percent: number;
}

export function pointLabel(point: DatedCount, isLatest: boolean): string {
  return isLatest && !point.date.endsWith("-01-01") ? `Now (${point.date})` : point.date.slice(0, 4);
}

export function seriesBars(points: readonly DatedCount[], noun: string): SeriesBar[] {
  return points.map((point, index) => {
    const label = pointLabel(point, index === points.length - 1);
    return { label, value: point.count, tip: `${label}: ${formatNumber(point.count)} ${noun}` };
  });
}

export function change(points: readonly DatedCount[]): Change | null {
  const from = points[0];
  const to = points[points.length - 1];
  if (!from || !to || from === to || from.count === 0) return null;
  return { from, to, percent: (100 * (to.count - from.count)) / from.count };
}

export function changeText(delta: Change | null): string | null {
  if (!delta) return null;
  const rounded = Math.round(Math.abs(delta.percent));
  const direction = delta.percent < 0 ? "down" : "up";
  return `${direction} ${rounded}% since ${delta.from.date.slice(0, 4)}`;
}

export function seriesChart(points: readonly DatedCount[], noun: string, axisLabel: string): Chart | null {
  if (points.length === 0) return null;
  const bars = seriesBars(points, noun);
  const ymax = Math.max(...bars.map((bar) => bar.value));
  return {
    ariaLabel: bars.map((bar) => bar.tip).join(", "),
    summary: null,
    spec: {
      options: {
        height: 280,
        marginLeft: 56,
        marginTop: 24,
        marginBottom: 40,
        x: { label: null, domain: bars.map((bar) => bar.label), padding: 0.3 },
        y: { label: axisLabel, domain: [0, ymax * 1.15 || 1], grid: true },
      },
      marks: [
        { type: "barY", data: bars, options: { x: "label", y: "value", fill: "var(--accent)" } },
        tipMark(bars, "x", { x: "label", y: "value", title: "tip" }),
      ],
    },
  };
}

export interface PinRow {
  name: string;
  version: string | null;
}

export function pinRows(pins: Record<string, string | null> | undefined): PinRow[] {
  return Object.entries(pins ?? {}).map(([name, version]) => ({ name, version }));
}

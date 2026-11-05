import type { Chart } from "../../components/charts";
import { tipMark } from "../../components/charts";
import { formatNumber } from "../../format";
import type { DatedCount, TrendOrganisation, TrendYear } from "../../data/schemas";

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

function percentText(percent: number, since: string | number): string {
  return `${percent < 0 ? "down" : "up"} ${Math.round(Math.abs(percent))}% since ${since}`;
}

export function changeText(delta: Change | null): string | null {
  return delta ? percentText(delta.percent, delta.from.date.slice(0, 4)) : null;
}

export function changeSince(
  from: number | null | undefined,
  to: number | null | undefined,
  year: number | undefined,
): string | null {
  if (from == null || to == null || year === undefined || from === 0 || from === to) return null;
  return percentText((100 * (to - from)) / from, year);
}

export function seriesChart(points: readonly DatedCount[], noun: string, axisLabel: string): Chart | null {
  return barChart(seriesBars(points, noun), axisLabel);
}

export function barChart(bars: readonly SeriesBar[], axisLabel: string): Chart | null {
  if (bars.length === 0) return null;
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(month: string): string {
  const [year, number] = month.split("-");
  return `${MONTHS[Number(number) - 1] ?? number} ${year}`;
}

export function yearLabel(year: TrendYear): string {
  return year.complete ? String(year.year) : `${year.year} (to ${monthLabel(year.through)})`;
}

export function yearBars(
  years: readonly TrendYear[],
  pick: (year: TrendYear) => number | null,
  noun: string,
): SeriesBar[] {
  return years.flatMap((year) => {
    const value = pick(year);
    if (value === null) return [];
    const label = yearLabel(year);
    return [{ label, value, tip: `${label}: ${formatNumber(value)} ${noun}` }];
  });
}

export function setAside(years: readonly TrendYear[]): { bots: number; mechanical: number } {
  return years.reduce(
    (sum, year) => ({ bots: sum.bots + year.bot_commits, mechanical: sum.mechanical + year.mechanical_commits }),
    { bots: 0, mechanical: 0 },
  );
}

const BUCKET_NAMES: Record<Exclude<TrendOrganisation["kind"], "domain">, string> = {
  other: "Other domains",
  noreply: "GitHub private addresses",
  personal: "Personal addresses",
  unknown: "Unrecognised addresses",
};

export function organisationName(row: TrendOrganisation): string {
  if (row.kind === "domain") return row.name;
  const name = BUCKET_NAMES[row.kind];
  if (row.kind !== "other" || !row.domains) return name;
  return `${name} (${formatNumber(row.domains)} ${row.domains === 1 ? "domain" : "domains"})`;
}

export interface PinRow {
  name: string;
  version: string | null;
}

export function pinRows(pins: Record<string, string | null> | undefined): PinRow[] {
  return Object.entries(pins ?? {}).map(([name, version]) => ({ name, version }));
}

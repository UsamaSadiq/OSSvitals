import { tipMark, type Chart } from "../../components/charts";
import type { RepoDetailView } from "../../data/schemas";
import { toFixedHalfEven } from "../../format";
import { humanizeMetric, metricKey } from "../RepoDetail/metricNames";
import type { MetricRow } from "./scoringText";

export type MetricBar = RepoDetailView["repos"][string]["metric_bars"][number];

const CATEGORY_FILLS = ["var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-1)"];
const OTHER_FILL = "var(--cat-7)";
const DEFAULTED_FILL = "color-mix(in srgb, var(--muted) 45%, transparent)";
const SEGMENT_GAP = { stroke: "var(--surface)", strokeWidth: 2 };
const BAR_HEIGHT = 64;

export function categoryFills(categories: readonly string[]): ReadonlyMap<string, string> {
  const distinct = [...new Set(categories)].sort();
  return new Map(distinct.map((category, index) => [category, CATEGORY_FILLS[index] ?? OTHER_FILL]));
}

function categoryLabel(category: string): string {
  return category ? category.charAt(0).toUpperCase() + category.slice(1) : "Uncategorised";
}

interface Span {
  x1: number;
  x2: number;
  middle: number;
}

function spans(widths: readonly number[]): Span[] {
  const ends = widths.reduce<number[]>((acc, width) => [...acc, (acc.at(-1) ?? 0) + width], []);
  return widths.map((width, index) => {
    const x2 = ends[index] ?? 0;
    return { x1: x2 - width, x2, middle: x2 - width / 2 };
  });
}

export interface WeightSegment extends Span {
  metric: string;
  name: string;
  category: string;
  weight_pct: number;
  fill: string;
  tip: string;
}

function byCategoryThenWeight(a: MetricRow, b: MetricRow): number {
  return a.category.localeCompare(b.category) || b.weight_pct - a.weight_pct || a.metric.localeCompare(b.metric);
}

export function weightSegments(rows: readonly MetricRow[]): WeightSegment[] {
  const ordered = [...rows].sort(byCategoryThenWeight);
  const fills = categoryFills(ordered.map((row) => row.category));
  const positions = spans(ordered.map((row) => row.weight_pct / 100));
  return ordered.map((row, index) => {
    const name = humanizeMetric(row.metric);
    return {
      ...(positions[index] ?? { x1: 0, x2: 0, middle: 0 }),
      metric: row.metric,
      name,
      category: row.category,
      weight_pct: row.weight_pct,
      fill: fills.get(row.category) ?? OTHER_FILL,
      tip: `${name}\n${categoryLabel(row.category)} · ${toFixedHalfEven(row.weight_pct, 0)}% of the composite weight`,
    };
  });
}

export interface CategoryShare {
  category: string;
  label: string;
  weight_pct: number;
  fill: string;
}

export function categoryShares(segments: readonly WeightSegment[]): CategoryShare[] {
  const totals = segments.reduce<ReadonlyMap<string, CategoryShare>>((acc, segment) => {
    const current = acc.get(segment.category);
    const weight = (current?.weight_pct ?? 0) + segment.weight_pct;
    return new Map(acc).set(segment.category, {
      category: segment.category,
      label: categoryLabel(segment.category),
      weight_pct: weight,
      fill: segment.fill,
    });
  }, new Map());
  return [...totals.values()];
}

function percent(value: number): string {
  return `${toFixedHalfEven(value, 0)}%`;
}

export function weightsChart(rows: readonly MetricRow[]): Chart {
  const segments = weightSegments(rows);
  const total = Math.max(1, segments.at(-1)?.x2 ?? 0);
  const shares = categoryShares(segments);
  return {
    ariaLabel: `Configured weight per metric: ${segments.map((segment) => `${segment.name} ${percent(segment.weight_pct)}`).join(", ")}`,
    summary: `${shares.map((share) => `${share.label} ${percent(share.weight_pct)}`).join(" · ")} of the configured weight`,
    spec: {
      options: {
        height: BAR_HEIGHT,
        marginTop: 4,
        marginLeft: 8,
        marginRight: 8,
        marginBottom: 28,
        x: { label: null, domain: [0, total], tickFormat: "%" },
        color: { type: "identity" },
      },
      marks: [
        { type: "barX", data: segments, options: { x1: "x1", x2: "x2", fill: "fill", ...SEGMENT_GAP } },
        tipMark(segments, "x", { x: "middle", title: "tip" }),
      ],
    },
  };
}

export type ContributionState = MetricBar["state"];

export interface Contribution {
  metric: string;
  name: string;
  state: ContributionState;
  score: number;
  weight: number | null;
  share: number;
  points: number;
}

export interface ScoreBreakdown {
  rows: Contribution[];
  total: number;
  composite: number;
  renormalised: boolean;
}

function counts(bar: MetricBar): boolean {
  return bar.state !== "unavailable" && bar.weight !== null;
}

function weightOf(bar: MetricBar): number {
  return counts(bar) ? (bar.weight ?? 0) : 0;
}

export function scoreBreakdown(bars: readonly MetricBar[], composite: number): ScoreBreakdown {
  const counted = bars.reduce((total, bar) => total + weightOf(bar), 0);
  const rows = bars.map((bar) => {
    const share = counted > 0 ? weightOf(bar) / counted : 0;
    return {
      metric: bar.metric,
      name: humanizeMetric(bar.metric),
      state: bar.state,
      score: bar.score,
      weight: bar.weight,
      share,
      points: counts(bar) ? bar.score * share : 0,
    };
  });
  return {
    rows,
    total: rows.reduce((total, row) => total + row.points, 0),
    composite,
    renormalised: bars.some((bar) => !counts(bar)),
  };
}

export interface ContributionSegment extends Span {
  metric: string;
  points: number;
  fill: string;
  tip: string;
}

function contributionTip(row: Contribution): string {
  const state = row.state === "defaulted" ? " (default, not measured)" : "";
  return `${row.name}${state}\nScore ${toFixedHalfEven(row.score, 1)} × ${toFixedHalfEven(row.share * 100, 1)}% = ${toFixedHalfEven(row.points, 2)} points`;
}

export function contributionSegments(breakdown: ScoreBreakdown, fills: ReadonlyMap<string, string>): ContributionSegment[] {
  const shown = breakdown.rows.filter((row) => row.points > 0);
  const positions = spans(shown.map((row) => row.points));
  return shown.map((row, index) => ({
    ...(positions[index] ?? { x1: 0, x2: 0, middle: 0 }),
    metric: row.metric,
    points: row.points,
    fill: row.state === "defaulted" ? DEFAULTED_FILL : (fills.get(metricKey(row.metric)) ?? OTHER_FILL),
    tip: contributionTip(row),
  }));
}

export function metricFills(rows: readonly MetricRow[]): ReadonlyMap<string, string> {
  return new Map(weightSegments(rows).map((segment) => [metricKey(segment.metric), segment.fill]));
}

export function contributionChart(repo: string, breakdown: ScoreBreakdown, fills: ReadonlyMap<string, string>): Chart {
  const segments = contributionSegments(breakdown, fills);
  return {
    ariaLabel: `${repo} composite ${toFixedHalfEven(breakdown.composite, 2)} built from: ${breakdown.rows
      .map((row) => `${row.name} ${toFixedHalfEven(row.points, 2)}`)
      .join(", ")}`,
    summary: null,
    spec: {
      options: {
        height: BAR_HEIGHT,
        marginTop: 4,
        marginLeft: 8,
        marginRight: 8,
        marginBottom: 28,
        x: { label: null, domain: [0, 100] },
        color: { type: "identity" },
      },
      marks: [
        { type: "barX", data: [{ x1: 0, x2: 100 }], options: { x1: "x1", x2: "x2", fill: "var(--surface-alt)", stroke: "var(--border)" } },
        { type: "barX", data: segments, options: { x1: "x1", x2: "x2", fill: "fill", ...SEGMENT_GAP } },
        tipMark(segments, "x", { x: "middle", title: "tip" }),
      ],
    },
  };
}

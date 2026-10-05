import { formatNumber, toFixedHalfEven } from "../format";
import type { ChartSpec } from "./chartSpec";
import { GRADE_ORDER, type Grade } from "./GradePill";

export type GradeMix = Record<Grade, number>;

export interface Chart {
  spec: ChartSpec;
  ariaLabel: string;
  summary: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CHAR_WIDTH_PX = 8;

export function gradeFill(grade: Grade): string {
  return `var(--grade-${grade.toLowerCase()})`;
}

export function gradeTextFill(grade: Grade): string {
  return `var(--grade-${grade.toLowerCase()}-text)`;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function share(count: number, total: number): number {
  return total > 0 ? (100 * count) / total : 0;
}

function labelMargin(labels: readonly string[], min: number, max: number): number {
  const longest = Math.max(0, ...labels.map((label) => label.length));
  return Math.min(max, Math.max(min, longest * CHAR_WIDTH_PX + 12));
}

export function gradeTotal(mix: GradeMix): number {
  return sum(GRADE_ORDER.map((grade) => mix[grade]));
}

export interface GradeBar {
  grade: Grade;
  count: number;
  label: string;
  fill: string;
}

export function gradeBars(mix: GradeMix): GradeBar[] {
  const total = gradeTotal(mix);
  return GRADE_ORDER.map((grade) => ({
    grade,
    count: mix[grade],
    label: `${mix[grade]}  ${toFixedHalfEven(share(mix[grade], total))}%`,
    fill: gradeFill(grade),
  }));
}

export function gradeSummary(mix: GradeMix): string | null {
  const total = gradeTotal(mix);
  if (!total) return null;
  const atLeastB = mix.A + mix.B;
  return `${atLeastB}/${total} repos (${toFixedHalfEven(share(atLeastB, total))}%) at grade B or better`;
}

export function gradeDistributionChart(mix: GradeMix): Chart {
  const bars = gradeBars(mix);
  const ymax = Math.max(0, ...bars.map((bar) => bar.count));
  return {
    ariaLabel: `Repositories per grade: ${bars.map((bar) => `${bar.grade} ${bar.count}`).join(", ")}`,
    summary: gradeSummary(mix),
    spec: {
      options: {
        height: 320,
        marginLeft: 56,
        marginTop: 28,
        marginBottom: 40,
        x: { label: "Grade", domain: [...GRADE_ORDER], padding: 0.35 },
        y: { label: "Repositories", domain: [0, ymax ? ymax * 1.18 : 1], grid: true },
        color: { type: "identity" },
      },
      marks: [
        { type: "barY", data: bars, options: { x: "grade", y: "count", fill: "fill" } },
        {
          type: "text",
          data: bars,
          options: { x: "grade", y: "count", text: "label", dy: -10, fill: "var(--text)", fontSize: 13 },
        },
      ],
    },
  };
}

export type RibbonLabelDetail = "full" | "letter" | "none";

export interface RibbonSegment {
  grade: Grade;
  count: number;
  percent: number;
  labelDetail: RibbonLabelDetail;
}

function ribbonLabelDetail(percent: number): RibbonLabelDetail {
  if (percent >= 6) return "full";
  return percent >= 3 ? "letter" : "none";
}


export function gradeRibbonSegments(mix: GradeMix): RibbonSegment[] {
  const total = gradeTotal(mix) || 1;
  return GRADE_ORDER.filter((grade) => mix[grade] > 0).map((grade) => {
    const percent = share(mix[grade], total);
    return { grade, count: mix[grade], percent, labelDetail: ribbonLabelDetail(percent) };
  });
}

export interface CategoryPassRate {
  category: string;
  pass_rate: number;
}

export function categoryPassRateSummary(rows: readonly CategoryPassRate[]): string | null {
  if (rows.length === 0) return null;
  const average = sum(rows.map((row) => row.pass_rate)) / rows.length;
  return `avg ${toFixedHalfEven(average)}% pass · ${rows.length} categories`;
}

export function categoryPassRateChart(rows: readonly CategoryPassRate[]): Chart {
  const bars = rows.map((row) => ({ ...row, label: `${toFixedHalfEven(row.pass_rate)}%` }));
  const categories = rows.map((row) => row.category);
  return {
    ariaLabel: `Pass rate per check category: ${bars.map((bar) => `${bar.category} ${bar.label}`).join(", ")}`,
    summary: categoryPassRateSummary(rows),
    spec: {
      options: {
        height: Math.max(200, 40 * rows.length + 60),
        marginLeft: labelMargin(categories, 60, 200),
        marginRight: 48,
        x: { label: "Pass rate (%)", domain: [0, 100], grid: true },
        y: { label: null, domain: categories, padding: 0.3 },
      },
      marks: [
        { type: "barX", data: bars, options: { x: "pass_rate", y: "category", fill: "var(--primary)" } },
        {
          type: "text",
          data: bars,
          options: { x: "pass_rate", y: "category", text: "label", dx: 6, textAnchor: "start", fill: "var(--text)" },
        },
      ],
    },
  };
}

export interface FailingCheck {
  check: string;
  failing: number;
}

export function topFailingSummary(rows: readonly FailingCheck[]): string {
  return `${sum(rows.map((row) => row.failing))} failures across ${rows.length} checks`;
}

export function topFailingChart(rows: readonly FailingCheck[]): Chart {
  const checks = rows.map((row) => row.check);
  return {
    ariaLabel: `Repositories failing each check: ${rows.map((row) => `${row.check} ${row.failing}`).join(", ")}`,
    summary: topFailingSummary(rows),
    spec: {
      options: {
        height: Math.max(280, 32 * rows.length + 80),
        marginLeft: labelMargin(checks, 80, 280),
        marginRight: 24,
        x: { label: "Repos failing", domain: [0, Math.max(1, ...rows.map((row) => row.failing))], nice: true, grid: true },
        y: { label: null, domain: checks },
      },
      marks: [
        {
          type: "ruleY",
          data: rows,
          options: { y: "check", x1: 0, x2: "failing", stroke: "var(--border)", strokeWidth: 2 },
        },
        {
          type: "dot",
          data: rows,
          options: {
            x: "failing",
            y: "check",
            r: 7,
            fill: "var(--primary)",
            stroke: "var(--surface-alt)",
            strokeWidth: 2,
          },
        },
      ],
    },
  };
}

export type SeriesPoint = readonly [string, number];

export function lastDays(series: readonly SeriesPoint[], days: number): SeriesPoint[] {
  const last = series.at(-1);
  if (!last) return [];
  const cutoff = Date.parse(last[0]) - days * DAY_MS;
  return series.filter(([date]) => Date.parse(date) >= cutoff);
}

export function sparklineChart(series: readonly SeriesPoint[]): Chart | null {
  if (series.length < 2) return null;
  const points = series.map(([date, value]) => ({ date: new Date(date), value }));
  const first = series[0];
  const last = series.at(-1);
  return {
    ariaLabel: `Org-average composite over ${series.length} snapshots, from ${formatNumber(first?.[1] ?? 0, 1)} to ${formatNumber(last?.[1] ?? 0, 1)}`,
    summary: `Org-average composite · last ${series.length} snapshots`,
    spec: {
      options: {
        height: 40,
        margin: 3,
        x: { axis: null },
        y: { axis: null },
      },
      marks: [{ type: "lineY", data: points, options: { x: "date", y: "value", stroke: "var(--accent)", strokeWidth: 2 } }],
    },
  };
}

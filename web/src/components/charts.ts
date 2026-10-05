import { formatNumber, toFixedHalfEven } from "../format";
import { labelAxis, type ChartSpec, type MarkSpec, type PointerAxis, type TipMarkOptions } from "./chartSpec";
import { GRADE_ORDER, type Grade } from "./GradePill";
import { reposGradePath } from "./reposPath";

export type GradeMix = Record<Grade, number>;

export interface ChartLink {
  label: string;
  to: string;
}

export interface ChartLinkList {
  lead: string;
  items: readonly ChartLink[];
}

export interface Chart {
  spec: ChartSpec;
  ariaLabel: string;
  summary: string | null;
  links?: ChartLinkList;
}

export const FAILING_CHECKS_PATH = "/failing_checks";
export const CHECKS_CATALOG_PATH = "/glossary";
export const NARROW_CHART_PX = 560;

export const SPARKLINE_POINTER_RADIUS = 1000;

const TIP_STYLE: TipMarkOptions = {
  fill: "var(--surface)",
  stroke: "var(--border)",
  fontSize: 12,
  lineWidth: 22,
  pointerEvents: "none",
};

export function tipMark(data: readonly object[], pointer: PointerAxis, options: TipMarkOptions): MarkSpec {
  return { type: "tip", data, pointer, options: { ...TIP_STYLE, ...options } };
}

export function failingCheckPath(check: string): string {
  return `${FAILING_CHECKS_PATH}?${new URLSearchParams({ category: check }).toString()}`;
}

function plural(count: number, one: string, many: string): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
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
  tip: string;
  to: string;
}

export function gradeBars(mix: GradeMix): GradeBar[] {
  const total = gradeTotal(mix);
  return GRADE_ORDER.map((grade) => {
    const percent = `${toFixedHalfEven(share(mix[grade], total))}%`;
    return {
      grade,
      count: mix[grade],
      label: `${mix[grade]}  ${percent}`,
      fill: gradeFill(grade),
      tip: `Grade ${grade}\n${plural(mix[grade], "repository", "repositories")} · ${percent} of scored`,
      to: reposGradePath(grade),
    };
  });
}

export function gradeSummary(mix: GradeMix): string | null {
  const total = gradeTotal(mix);
  if (!total) return null;
  const atLeastB = mix.A + mix.B;
  return `${atLeastB}/${total} repos (${toFixedHalfEven(share(atLeastB, total))}%) at grade B or better`;
}

export function gradeLinks(mix: GradeMix): ChartLinkList {
  return {
    lead: "Browse repositories:",
    items: GRADE_ORDER.filter((grade) => mix[grade] > 0).map((grade) => ({ label: `Grade ${grade}`, to: reposGradePath(grade) })),
  };
}

export function gradeDistributionChart(mix: GradeMix): Chart {
  const bars = gradeBars(mix);
  const ymax = Math.max(0, ...bars.map((bar) => bar.count));
  return {
    ariaLabel: `Repositories per grade: ${bars.map((bar) => `${bar.grade} ${bar.count}`).join(", ")}`,
    summary: gradeSummary(mix),
    links: gradeLinks(mix),
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
        { type: "barY", data: bars, link: "to", options: { x: "grade", y: "count", fill: "fill" } },
        {
          type: "text",
          data: bars,
          options: { x: "grade", y: "count", text: "label", dy: -10, fill: "var(--text)", fontSize: 13 },
        },
        tipMark(bars, "x", { x: "grade", y: "count", title: "tip" }),
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

function categoryBar(row: CategoryPassRate) {
  const label = `${toFixedHalfEven(row.pass_rate)}%`;
  return {
    ...row,
    label,
    tip: `${row.category}\n${toFixedHalfEven(row.pass_rate, 1)}% of checks pass`,
    to: CHECKS_CATALOG_PATH,
  };
}

export function categoryPassRateChart(rows: readonly CategoryPassRate[]): Chart {
  const bars = rows.map(categoryBar);
  const categories = rows.map((row) => row.category);
  return {
    ariaLabel: `Pass rate per check category: ${bars.map((bar) => `${bar.category} ${bar.label}`).join(", ")}`,
    summary: categoryPassRateSummary(rows),
    links: { lead: "Open:", items: [{ label: "Checks Catalog", to: CHECKS_CATALOG_PATH }] },
    spec: {
      options: {
        height: Math.max(200, 40 * rows.length + 60),
        marginLeft: labelMargin(categories, 60, 200),
        marginRight: 48,
        x: { label: "Pass rate (%)", domain: [0, 100], grid: true },
        y: { label: null, domain: categories, padding: 0.3 },
      },
      marks: [
        { type: "barX", data: bars, link: "to", options: { x: "pass_rate", y: "category", fill: "var(--primary)" } },
        {
          type: "text",
          data: bars,
          options: { x: "pass_rate", y: "category", text: "label", dx: 6, textAnchor: "start", fill: "var(--text)" },
        },
        tipMark(bars, "y", { x: "pass_rate", y: "category", title: "tip" }),
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

function failingRow(row: FailingCheck) {
  return {
    ...row,
    tip: `${row.check}\n${plural(row.failing, "repository fails", "repositories fail")}`,
    to: failingCheckPath(row.check),
  };
}

export function topFailingLinks(rows: readonly FailingCheck[]): ChartLinkList {
  return {
    lead: "Open a check:",
    items: rows.map((row) => ({ label: row.check, to: failingCheckPath(row.check) })),
  };
}

export function topFailingChart(rows: readonly FailingCheck[]): Chart {
  const data = rows.map(failingRow);
  const checks = rows.map((row) => row.check);
  const xmax = Math.max(1, ...rows.map((row) => row.failing));
  const marginLeft = labelMargin(checks, 80, 280);
  return {
    ariaLabel: `Repositories failing each check: ${rows.map((row) => `${row.check} ${row.failing}`).join(", ")}`,
    summary: topFailingSummary(rows),
    links: topFailingLinks(rows),
    spec: {
      options: {
        height: Math.max(280, 32 * rows.length + 80),
        marginLeft,
        marginRight: 24,
        x: { label: "Repos failing", domain: [0, xmax], nice: true, grid: true },
        y: { label: null, domain: checks },
      },
      narrow: { below: NARROW_CHART_PX, marginLeft: Math.min(marginLeft, 150), marginRight: 16 },
      marks: [
        {
          type: "barX",
          data,
          link: "to",
          options: { x1: 0, x2: xmax, y: "check", fill: "transparent", inset: 0 },
        },
        {
          type: "ruleY",
          data,
          options: {
            y: "check",
            x1: 0,
            x2: "failing",
            stroke: "var(--border)",
            strokeWidth: 2,
            pointerEvents: "none",
          },
        },
        {
          type: "dot",
          data,
          options: {
            x: "failing",
            y: "check",
            r: 7,
            fill: "var(--primary)",
            stroke: "var(--surface-alt)",
            strokeWidth: 2,
            pointerEvents: "none",
          },
        },
        labelAxis(marginLeft),
        tipMark(data, "y", { x: "failing", y: "check", title: "tip" }),
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
  const points = series.map(([date, value]) => ({
    date: new Date(date),
    value,
    tip: `${date}\nOrg average ${formatNumber(value, 1)}`,
  }));
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
      marks: [
        { type: "lineY", data: points, options: { x: "date", y: "value", stroke: "var(--accent)", strokeWidth: 2 } },
        tipMark(points, "x", { x: "date", y: "value", title: "tip", maxRadius: SPARKLINE_POINTER_RADIUS }),
      ],
    },
  };
}

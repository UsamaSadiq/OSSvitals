import { gradeFill, NARROW_CHART_PX, tipMark, type Chart } from "../../components/charts";
import { labelAxis } from "../../components/chartSpec";
import type { RepoDetailView, ScoringView } from "../../data/schemas";
import { formatPercent, toFixedHalfEven } from "../../format";
import { humanizeMetric, metricKey, wrapWords } from "./metricNames";

export type MetricBar = RepoDetailView["repos"][string]["metric_bars"][number];
export type MetricRule = Pick<ScoringView["metrics"][number], "metric" | "rule">;

export interface MetricBarDatum {
  metric: string;
  name: string;
  axisLabel: string;
  state: MetricBar["state"];
  value: number;
  label: string;
  fill: string;
  tip: string;
}

const MUTED_FILL = "color-mix(in srgb, var(--muted) 35%, transparent)";
const TRANSPARENT = "transparent";
const ROW_HEIGHT = 40;
const CHAR_WIDTH_PX = 7;
const RULE_LINE_CHARS = 34;
const NARROW_MARGIN_LEFT = 132;

export const SCORE_CAPTION_SUFFIX =
  "bars show each metric's score; the percentage beside each name is its weight in the composite.";

export function scoringCaption(version: unknown): string {
  return `Scoring config ${String(version ?? "unknown")} · ${SCORE_CAPTION_SUFFIX}`;
}

export function metricRules(rows: readonly MetricRule[]): ReadonlyMap<string, MetricRule> {
  return new Map(rows.map((row) => [metricKey(row.metric), row]));
}

function weightText(weight: number | null): string | null {
  return weight === null ? null : formatPercent(weight);
}

function axisLabel(name: string, weight: number | null): string {
  const weightLabel = weightText(weight);
  return weightLabel ? `${name} · ${weightLabel}` : name;
}

function stateLine(bar: MetricBar): string {
  const score = toFixedHalfEven(bar.score, 0);
  if (bar.state === "unavailable") return "Not collected in this snapshot";
  if (bar.state === "defaulted") return `Default score ${score} (not measured)`;
  return `Score ${score} · measured`;
}

function tipText(name: string, bar: MetricBar, rule: string | undefined): string {
  const weight = weightText(bar.weight);
  const ruleLines = rule ? wrapWords(`Rule: ${rule}`, RULE_LINE_CHARS) : [];
  return [name, stateLine(bar), ...(weight ? [`Weight ${weight}`] : []), ...ruleLines].join("\n");
}

function shown(bar: MetricBar): Pick<MetricBarDatum, "value" | "label" | "fill"> {
  const score = toFixedHalfEven(bar.score, 0);
  if (bar.state === "unavailable") return { value: 0, label: "not collected", fill: TRANSPARENT };
  if (bar.state === "defaulted") return { value: bar.score, label: `default (${score})`, fill: MUTED_FILL };
  return { value: bar.score, label: score, fill: gradeFill(bar.letter) };
}

function datum(bar: MetricBar, rules: ReadonlyMap<string, MetricRule>): MetricBarDatum {
  const scoring = rules.get(metricKey(bar.metric));
  const name = humanizeMetric(scoring?.metric ?? bar.metric);
  return {
    metric: bar.metric,
    name,
    axisLabel: axisLabel(name, bar.weight),
    state: bar.state,
    ...shown(bar),
    tip: tipText(name, bar, scoring?.rule),
  };
}

export function metricBarData(bars: readonly MetricBar[], rules: ReadonlyMap<string, MetricRule> = new Map()): MetricBarDatum[] {
  return bars.map((bar) => datum(bar, rules));
}

export function metricSummary(bars: readonly MetricBar[]): string {
  const measured = bars.filter((bar) => bar.state === "measured").length;
  return `${measured} of ${bars.length} metrics measured`;
}

function labelMargin(labels: readonly string[]): number {
  const longest = Math.max(0, ...labels.map((label) => label.length));
  return Math.min(260, Math.max(96, longest * CHAR_WIDTH_PX + 16));
}

export function metricBarsChart(bars: readonly MetricBar[], rules?: ReadonlyMap<string, MetricRule>): Chart {
  const data = metricBarData(bars, rules);
  const drawn = data.filter((entry) => entry.state !== "unavailable");
  const labels = data.map((entry) => entry.axisLabel);
  const marginLeft = labelMargin(labels);
  return {
    ariaLabel: `Metric scores: ${data.map((entry) => `${entry.name} ${entry.label}`).join(", ")}`,
    summary: metricSummary(bars),
    spec: {
      options: {
        height: Math.max(260, ROW_HEIGHT * data.length + 70),
        marginLeft,
        marginRight: 96,
        x: { label: "Score", domain: [0, 108], grid: true },
        y: { label: null, domain: labels, padding: 0.3 },
        color: { type: "identity" },
      },
      narrow: { below: NARROW_CHART_PX, marginLeft: Math.min(marginLeft, NARROW_MARGIN_LEFT), marginRight: 84 },
      marks: [
        { type: "barX", data: drawn, options: { x: "value", y: "axisLabel", fill: "fill" } },
        {
          type: "text",
          data,
          options: { x: "value", y: "axisLabel", text: "label", dx: 6, textAnchor: "start", fill: "var(--muted)" },
        },
        labelAxis(marginLeft, "wrap"),
        tipMark(data, "y", { x: "value", y: "axisLabel", title: "tip" }),
      ],
    },
  };
}

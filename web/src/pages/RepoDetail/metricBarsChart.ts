import { gradeFill, type Chart } from "../../components/charts";
import type { RepoDetailView } from "../../data/schemas";
import { toFixedHalfEven } from "../../format";

export type MetricBar = RepoDetailView["repos"][string]["metric_bars"][number];

export interface MetricBarDatum {
  metric: string;
  state: MetricBar["state"];
  value: number;
  label: string;
  fill: string;
}

const MUTED_FILL = "color-mix(in srgb, var(--muted) 35%, transparent)";
const TRANSPARENT = "transparent";
const ROW_HEIGHT = 34;
const CHAR_WIDTH_PX = 7;

export const SCORE_CAPTION_SUFFIX = "bars show each metric's contribution; unmeasured metrics are marked.";

export function scoringCaption(version: unknown): string {
  return `Scoring config ${String(version ?? "unknown")} · ${SCORE_CAPTION_SUFFIX}`;
}

function datum(bar: MetricBar): MetricBarDatum {
  const score = toFixedHalfEven(bar.score, 0);
  if (bar.state === "unavailable") {
    return { metric: bar.metric, state: bar.state, value: 0, label: "not collected", fill: TRANSPARENT };
  }
  if (bar.state === "defaulted") {
    return { metric: bar.metric, state: bar.state, value: bar.score, label: `default (${score})`, fill: MUTED_FILL };
  }
  return { metric: bar.metric, state: bar.state, value: bar.score, label: score, fill: gradeFill(bar.letter) };
}

export function metricBarData(bars: readonly MetricBar[]): MetricBarDatum[] {
  return bars.map(datum);
}

export function metricSummary(bars: readonly MetricBar[]): string {
  const measured = bars.filter((bar) => bar.state === "measured").length;
  return `${measured} of ${bars.length} metrics measured`;
}

function labelMargin(names: readonly string[]): number {
  const longest = Math.max(0, ...names.map((name) => name.length));
  return Math.min(260, Math.max(80, longest * CHAR_WIDTH_PX + 12));
}

export function metricBarsChart(bars: readonly MetricBar[]): Chart {
  const data = metricBarData(bars);
  const drawn = data.filter((entry) => entry.state !== "unavailable");
  const metrics = data.map((entry) => entry.metric);
  return {
    ariaLabel: `Metric scores: ${data.map((entry) => `${entry.metric} ${entry.label}`).join(", ")}`,
    summary: metricSummary(bars),
    spec: {
      options: {
        height: Math.max(260, ROW_HEIGHT * data.length + 70),
        marginLeft: labelMargin(metrics),
        marginRight: 96,
        x: { label: "Score", domain: [0, 108], grid: true },
        y: { label: null, domain: metrics, padding: 0.3 },
        color: { type: "identity" },
      },
      marks: [
        { type: "barX", data: drawn, options: { x: "value", y: "metric", fill: "fill" } },
        {
          type: "text",
          data,
          options: { x: "value", y: "metric", text: "label", dx: 6, textAnchor: "start", fill: "var(--muted)" },
        },
      ],
    },
  };
}

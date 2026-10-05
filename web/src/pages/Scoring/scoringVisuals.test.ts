import { describe, expect, it } from "vitest";
import { renderPlot } from "../../components/renderPlot";
import type { MetricRow } from "./scoringText";
import {
  categoryShares,
  contributionChart,
  contributionSegments,
  metricFills,
  scoreBreakdown,
  weightsChart,
  weightSegments,
  type MetricBar,
} from "./scoringVisuals";

function metric(name: string, category: string, weight_pct: number): MetricRow {
  return {
    metric: name,
    category,
    weight_pct,
    source: "",
    rule: "",
    missing_scores_as: 50,
    measured_pct: null,
    defaulted_pct: null,
    chaoss_metric: "",
    provisional: false,
    limitation: "",
  };
}

const METRICS = [
  metric("readme quality", "structural", 10),
  metric("commit recency", "activity", 15),
  metric("dependency freshness", "structural", 5),
  metric("pr response time", "activity", 15),
];

const BARS: MetricBar[] = [
  { metric: "commit_recency", state: "measured", score: 100, weight: 0.15, letter: "A" },
  { metric: "pr_response_time", state: "defaulted", score: 50, weight: 0.15, letter: "C" },
  { metric: "readme_quality", state: "measured", score: 83.33, weight: 0.1, letter: "A" },
  { metric: "dependency_freshness", state: "unavailable", score: 0, weight: null, letter: "F" },
];

describe("weights bar", () => {
  it("orders segments by category then weight and lays them end to end", () => {
    const segments = weightSegments(METRICS);
    expect(segments.map(({ name, x1, x2, fill }) => ({ name, x1, x2, fill }))).toEqual([
      { name: "Commit recency", x1: 0, x2: expect.closeTo(0.15), fill: "var(--cat-2)" },
      { name: "PR response time", x1: expect.closeTo(0.15), x2: expect.closeTo(0.3), fill: "var(--cat-2)" },
      { name: "README quality", x1: expect.closeTo(0.3), x2: expect.closeTo(0.4), fill: "var(--cat-3)" },
      { name: "Dependency freshness", x1: expect.closeTo(0.4), x2: expect.closeTo(0.45), fill: "var(--cat-3)" },
    ]);
    expect(segments[0]?.tip).toBe("Commit recency\nActivity · 15% of the composite weight");
  });

  it("totals the configured share per category", () => {
    expect(categoryShares(weightSegments(METRICS)).map(({ label, weight_pct }) => [label, weight_pct])).toEqual([
      ["Activity", 30],
      ["Structural", 15],
    ]);
  });

  it("names every metric for screen readers and tips each segment", () => {
    const chart = weightsChart(METRICS);
    expect(chart.ariaLabel).toBe(
      "Configured weight per metric: Commit recency 15%, PR response time 15%, README quality 10%, Dependency freshness 5%",
    );
    expect(chart.summary).toBe("Activity 30% · Structural 15% of the configured weight");
    expect(chart.spec.marks.map((mark) => mark.type)).toEqual(["barX", "tip"]);
    expect(chart.spec.options.x).toMatchObject({ domain: [0, 1], tickFormat: "%" });
  });
});

describe("score breakdown", () => {
  it("weights each counted metric by its share of the counted weight", () => {
    const breakdown = scoreBreakdown(BARS, 77.5);
    expect(breakdown.rows.map(({ metric, share, points }) => ({ metric, share, points }))).toEqual([
      { metric: "commit_recency", share: expect.closeTo(0.375), points: expect.closeTo(37.5) },
      { metric: "pr_response_time", share: expect.closeTo(0.375), points: expect.closeTo(18.75) },
      { metric: "readme_quality", share: expect.closeTo(0.25), points: expect.closeTo(20.8325) },
      { metric: "dependency_freshness", share: 0, points: 0 },
    ]);
    expect(breakdown.total).toBeCloseTo(77.08, 2);
    expect(breakdown.renormalised).toBe(true);
  });

  it("matches the composite when every metric is collected", () => {
    const counted = BARS.slice(0, 3);
    const composite = (100 * 0.15 + 50 * 0.15 + 83.33 * 0.1) / 0.4;
    const breakdown = scoreBreakdown(counted, Number(composite.toFixed(2)));
    expect(breakdown.total).toBeCloseTo(breakdown.composite, 2);
    expect(breakdown.renormalised).toBe(false);
  });

  it("gives no points when nothing is counted", () => {
    const breakdown = scoreBreakdown(BARS.slice(3), 0);
    expect(breakdown.total).toBe(0);
    expect(breakdown.rows[0]?.share).toBe(0);
  });

  it("stacks contributions in category colours, greys defaults and skips zero-point rows", () => {
    const breakdown = scoreBreakdown(BARS, 77.08);
    const segments = contributionSegments(breakdown, metricFills(METRICS));
    expect(segments.map(({ metric, x1, fill }) => ({ metric, x1, fill }))).toEqual([
      { metric: "commit_recency", x1: 0, fill: "var(--cat-2)" },
      { metric: "pr_response_time", x1: expect.closeTo(37.5), fill: "color-mix(in srgb, var(--muted) 45%, transparent)" },
      { metric: "readme_quality", x1: expect.closeTo(56.25), fill: "var(--cat-3)" },
    ]);
    expect(segments[1]?.tip).toBe("PR response time (default, not measured)\nScore 50.0 × 37.5% = 18.75 points");
  });

  it("scales the contribution bar to 100 points", () => {
    const chart = contributionChart("openedx/alpha", scoreBreakdown(BARS, 77.08), metricFills(METRICS));
    expect(chart.spec.options.x).toMatchObject({ domain: [0, 100] });
    expect(chart.summary).toBe("openedx/alpha: 77.08 of 100 points");
    expect(chart.ariaLabel).toBe(
      "openedx/alpha composite 77.08 built from: Commit recency 37.50, PR response time 18.75, README quality 20.83, Dependency freshness 0.00",
    );
  });

  it("renders both bars with Observable Plot", () => {
    const weights = renderPlot(weightsChart(METRICS).spec, 640, "Weights");
    expect(weights.querySelectorAll("rect")).toHaveLength(4);
    expect(weights.textContent).toContain("20%");
    const contributions = renderPlot(
      contributionChart("openedx/alpha", scoreBreakdown(BARS, 77.08), metricFills(METRICS)).spec,
      640,
      "Contributions",
    );
    expect(contributions.querySelectorAll("rect")).toHaveLength(4);
  });
});

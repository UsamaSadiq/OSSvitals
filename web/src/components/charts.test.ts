import { describe, expect, it } from "vitest";
import type { MarkSpec } from "./chartSpec";
import {
  categoryPassRateChart,
  failingCheckPath,
  gradeBars,
  gradeDistributionChart,
  gradeRibbonSegments,
  gradeSummary,
  lastDays,
  sparklineChart,
  topFailingChart,
} from "./charts";

const MIX = { A: 62, B: 68, C: 30, D: 8, F: 0 };

function markOf(marks: readonly MarkSpec[], type: MarkSpec["type"]): MarkSpec | undefined {
  return marks.find((mark) => mark.type === type);
}

function tipTexts(marks: readonly MarkSpec[]): string[] {
  const tip = markOf(marks, "tip");
  if (tip?.type !== "tip") return [];
  return (tip.data as { tip: string }[]).map((row) => row.tip);
}

describe("grade distribution", () => {
  it("builds one bar per grade in A to F order with count and percent labels", () => {
    expect(gradeBars(MIX).map(({ tip: _tip, to: _to, ...bar }) => bar)).toEqual([
      { grade: "A", count: 62, label: "62  37%", fill: "var(--grade-a)" },
      { grade: "B", count: 68, label: "68  40%", fill: "var(--grade-b)" },
      { grade: "C", count: 30, label: "30  18%", fill: "var(--grade-c)" },
      { grade: "D", count: 8, label: "8  5%", fill: "var(--grade-d)" },
      { grade: "F", count: 0, label: "0  0%", fill: "var(--grade-f)" },
    ]);
  });

  it("summarises grade B or better", () => {
    expect(gradeSummary(MIX)).toBe("130/168 repos (77%) at grade B or better");
    expect(gradeSummary({ A: 0, B: 0, C: 0, D: 0, F: 0 })).toBeNull();
  });

  it("rounds exact half percentages to even like Streamlit", () => {
    const mix = { A: 21, B: 0, C: 147, D: 0, F: 0 };
    expect(gradeBars(mix)[0]?.label).toBe("21  12%");
    expect(gradeSummary(mix)).toBe("21/168 repos (12%) at grade B or better");
  });

  it("labels the axes and leaves headroom above the tallest bar", () => {
    const { spec, ariaLabel } = gradeDistributionChart(MIX);
    expect(spec.options.x).toMatchObject({ label: "Grade", domain: ["A", "B", "C", "D", "F"] });
    expect(spec.options.y).toMatchObject({ label: "Repositories" });
    expect((spec.options.y?.domain as number[])[1]).toBeCloseTo(68 * 1.18);
    expect(spec.marks.map((mark) => mark.type)).toEqual(["barY", "text", "tip"]);
    expect(ariaLabel).toBe("Repositories per grade: A 62, B 68, C 30, D 8, F 0");
  });

  it("adds a tooltip per grade with count and share", () => {
    const chart = gradeDistributionChart(MIX);
    expect(tipTexts(chart.spec.marks)).toEqual([
      "Grade A\n62 repositories · 37% of scored",
      "Grade B\n68 repositories · 40% of scored",
      "Grade C\n30 repositories · 18% of scored",
      "Grade D\n8 repositories · 5% of scored",
      "Grade F\n0 repositories · 0% of scored",
    ]);
    expect(markOf(chart.spec.marks, "tip")).toMatchObject({ pointer: "x", options: { title: "tip", fill: "var(--surface)" } });
  });

  it("links each bar and each non-empty grade to the explorer filtered by it", () => {
    const chart = gradeDistributionChart(MIX);
    expect(gradeBars(MIX).map((bar) => bar.to)).toEqual([
      "/repos?grade=A",
      "/repos?grade=B",
      "/repos?grade=C",
      "/repos?grade=D",
      "/repos?grade=F",
    ]);
    expect(markOf(chart.spec.marks, "barY")).toMatchObject({ link: "to" });
    expect(chart.links).toEqual({
      lead: "Browse repositories:",
      items: [
        { label: "Grade A", to: "/repos?grade=A" },
        { label: "Grade B", to: "/repos?grade=B" },
        { label: "Grade C", to: "/repos?grade=C" },
        { label: "Grade D", to: "/repos?grade=D" },
      ],
    });
  });
});

describe("grade ribbon", () => {
  it("skips empty grades and labels by share", () => {
    const segments = gradeRibbonSegments({ A: 90, B: 5, C: 4, D: 1, F: 0 });
    expect(segments.map(({ grade, labelDetail }) => [grade, labelDetail])).toEqual([
      ["A", "full"],
      ["B", "letter"],
      ["C", "letter"],
      ["D", "none"],
    ]);
  });

  it("uses the 6% and 3% thresholds inclusively", () => {
    const details = gradeRibbonSegments({ A: 6, B: 3, C: 91, D: 0, F: 0 }).map((segment) => segment.labelDetail);
    expect(details).toEqual(["full", "letter", "full"]);
  });

  it("returns nothing for an empty mix", () => {
    expect(gradeRibbonSegments({ A: 0, B: 0, C: 0, D: 0, F: 0 })).toEqual([]);
  });
});

describe("category pass rate", () => {
  it("draws horizontal bars in percent with an average summary", () => {
    const chart = categoryPassRateChart([
      { category: "README", pass_rate: 48.91 },
      { category: "Dependencies", pass_rate: 8.26 },
    ]);
    expect(chart.summary).toBe("avg 29% pass · 2 categories");
    expect(chart.spec.options.x).toMatchObject({ label: "Pass rate (%)", domain: [0, 100] });
    expect(chart.spec.options.y).toMatchObject({ domain: ["README", "Dependencies"] });
    const [bars, labels] = chart.spec.marks;
    expect(bars).toMatchObject({ type: "barX", link: "to" });
    expect(labels?.type === "text" && labels.data).toEqual([
      { category: "README", pass_rate: 48.91, label: "49%", tip: "README\n48.9% of checks pass", to: "/glossary" },
      { category: "Dependencies", pass_rate: 8.26, label: "8%", tip: "Dependencies\n8.3% of checks pass", to: "/glossary" },
    ]);
  });

  it("links bars and a single keyboard link to the Checks Catalog", () => {
    const chart = categoryPassRateChart([{ category: "README", pass_rate: 48.91 }]);
    expect(chart.links).toEqual({ lead: "Open:", items: [{ label: "Checks Catalog", to: "/glossary" }] });
    expect(tipTexts(chart.spec.marks)).toEqual(["README\n48.9% of checks pass"]);
  });
});

describe("top failing checks", () => {
  it("keeps the given order, largest on top, and totals the failures", () => {
    const chart = topFailingChart([
      { check: "makefile.test-js", failing: 165 },
      { check: "exists.transifex_config", failing: 146 },
    ]);
    expect(chart.summary).toBe("311 failures across 2 checks");
    expect(chart.spec.options.y).toMatchObject({ domain: ["makefile.test-js", "exists.transifex_config"] });
    expect(chart.spec.options.x).toMatchObject({ label: "Repos failing" });
    expect(chart.spec.marks.map((mark) => mark.type)).toEqual(["barX", "ruleY", "dot", "axisY", "tip"]);
    expect(chart.spec.options.height).toBe(280);
  });

  it("drills each check into Failing Checks by row and by an accessible link list", () => {
    const chart = topFailingChart([
      { check: "makefile.test-js", failing: 165 },
      { check: "exists.transifex_config", failing: 1 },
    ]);
    expect(failingCheckPath("a b&c")).toBe("/failing_checks?category=a+b%26c");
    expect(chart.links).toEqual({
      lead: "Open a check:",
      items: [
        { label: "makefile.test-js", to: "/failing_checks?category=makefile.test-js" },
        { label: "exists.transifex_config", to: "/failing_checks?category=exists.transifex_config" },
      ],
    });
    const hitArea = chart.spec.marks[0];
    expect(hitArea).toMatchObject({ type: "barX", link: "to", options: { x1: 0, x2: 165, fill: "transparent" } });
    expect(tipTexts(chart.spec.marks)).toEqual([
      "makefile.test-js\n165 repositories fail",
      "exists.transifex_config\n1 repository fails",
    ]);
  });

  it("truncates long labels at 12px and narrows the margin on phones", () => {
    const chart = topFailingChart([{ check: "a-very-long-check-name.with_many_segments.and_more", failing: 3 }]);
    expect(chart.spec.options.marginLeft).toBe(280);
    expect(markOf(chart.spec.marks, "axisY")).toMatchObject({
      options: { fontSize: 12, textOverflow: "ellipsis-end", lineWidth: (280 - 12) / 12 },
    });
    expect(chart.spec.narrow).toEqual({ below: 560, marginLeft: 150, marginRight: 16 });
  });
});

describe("org-average sparkline", () => {
  const series: [string, number][] = [
    ["2026-08-01", 60],
    ["2026-09-02", 65],
    ["2026-09-25", 70.35],
    ["2026-10-02", 70.04],
  ];

  it("keeps the last 30 days relative to the latest point", () => {
    expect(lastDays(series, 30)).toEqual(series.slice(1));
    expect(lastDays([], 30)).toEqual([]);
  });

  it("needs at least two points", () => {
    expect(sparklineChart(series.slice(0, 1))).toBeNull();
    expect(sparklineChart(series)?.summary).toBe("Org-average composite · last 4 snapshots");
  });

  it("hides both axes", () => {
    const chart = sparklineChart(series);
    expect(chart?.spec.options.x).toEqual({ axis: null });
    expect(chart?.spec.options.y).toEqual({ axis: null });
  });

  it("shows the date and average on hover", () => {
    const chart = sparklineChart(series.slice(2));
    expect(tipTexts(chart?.spec.marks ?? [])).toEqual(["2026-09-25\nOrg average 70.4", "2026-10-02\nOrg average 70.0"]);
    expect(markOf(chart?.spec.marks ?? [], "tip")).toMatchObject({ pointer: "x" });
  });
});

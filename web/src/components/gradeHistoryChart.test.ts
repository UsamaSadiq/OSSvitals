import { describe, expect, it } from "vitest";
import {
  AREA_MIN_SNAPSHOTS,
  gradeBands,
  gradeHistoryChart,
  gradeHistorySummary,
  gradeSnapshots,
  stackStyle,
} from "./gradeHistoryChart";

const FIRST = { A: 59, B: 70, C: 30, D: 8, F: 3 };
const LAST = { A: 62, B: 68, C: 29, D: 9, F: 2 };
const HISTORY = { dates: ["2026-08-16", "2026-08-31"], counts: [FIRST, LAST] };

function dailyHistory(days: number) {
  const dates = Array.from({ length: days }, (_, day) => `2026-08-${String(day + 1).padStart(2, "0")}`);
  return { dates, counts: dates.map(() => FIRST) };
}

describe("grades over time", () => {
  it("stacks each snapshot's grades from A at the bottom to F on top", () => {
    const bands = gradeBands(gradeSnapshots(HISTORY)).filter((band) => band.day === "2026-08-16");
    expect(bands.map(({ grade, y1, y2, middle }) => ({ grade, y1, y2, middle }))).toEqual([
      { grade: "A", y1: 0, y2: 59, middle: 29.5 },
      { grade: "B", y1: 59, y2: 129, middle: 94 },
      { grade: "C", y1: 129, y2: 159, middle: 144 },
      { grade: "D", y1: 159, y2: 167, middle: 163 },
      { grade: "F", y1: 167, y2: 170, middle: 168.5 },
    ]);
    expect(bands.map((band) => band.fill)).toEqual([
      "var(--grade-a)",
      "var(--grade-b)",
      "var(--grade-c)",
      "var(--grade-d)",
      "var(--grade-f)",
    ]);
  });

  it("drops dates without a matching count", () => {
    expect(gradeSnapshots({ dates: ["2026-08-16", "2026-08-31"], counts: [FIRST] })).toEqual([
      { day: "2026-08-16", mix: FIRST },
    ]);
  });

  it("tips each non-empty band with its date, grade and count", () => {
    const chart = gradeHistoryChart({ dates: ["2026-08-31"], counts: [{ A: 1, B: 0, C: 2, D: 0, F: 0 }] });
    const tip = chart.spec.marks.find((mark) => mark.type === "tip");
    expect(tip).toMatchObject({ pointer: "xy", options: { y: "middle", title: "tip" } });
    expect((tip?.type === "tip" ? (tip.data as { tip: string }[]) : []).map((row) => row.tip)).toEqual([
      "2026-08-31\nGrade A: 1 repository",
      "2026-08-31\nGrade C: 2 repositories",
    ]);
  });

  it("uses stacked bars for few snapshots and a stacked area for many", () => {
    expect(stackStyle(gradeSnapshots(HISTORY))).toBe("bars");
    expect(stackStyle(gradeSnapshots(dailyHistory(AREA_MIN_SNAPSHOTS)))).toBe("area");
    expect(gradeHistoryChart(HISTORY).spec.marks.map((mark) => mark.type)).toEqual(["barY", "tip"]);
    expect(gradeHistoryChart(HISTORY).spec.options.x).toMatchObject({ domain: ["2026-08-16", "2026-08-31"] });
    const area = gradeHistoryChart(dailyHistory(AREA_MIN_SNAPSHOTS));
    expect(area.spec.marks[0]).toMatchObject({ type: "areaY", options: { x: "date", z: "grade", fill: "fill" } });
    expect(area.spec.options.x).toMatchObject({ type: "utc" });
  });

  it("scales the y axis to the largest snapshot total", () => {
    expect(gradeHistoryChart(HISTORY).spec.options.y).toMatchObject({ label: "Repositories", domain: [0, 170] });
  });

  it("summarises how A and F changed since the first snapshot", () => {
    const snapshots = gradeSnapshots(HISTORY);
    expect(gradeHistorySummary(snapshots)).toBe("A grew from 59 to 62 and F fell from 3 to 2 since 2026-08-16.");
    expect(gradeHistorySummary(gradeSnapshots(dailyHistory(3)))).toBe(
      "A held at 59 and F held at 3 since 2026-08-01.",
    );
    expect(gradeHistorySummary(snapshots.slice(0, 1))).toBe("One snapshot so far (2026-08-16).");
    expect(gradeHistorySummary([])).toBeNull();
  });

  it("describes every grade's change for screen readers and links the latest grades", () => {
    const chart = gradeHistoryChart(HISTORY);
    expect(chart.ariaLabel).toBe(
      "Repositories per grade over 2 snapshots from 2026-08-16 to 2026-08-31: A 59 to 62, B 70 to 68, C 30 to 29, D 8 to 9, F 3 to 2",
    );
    expect(chart.links?.items.map((item) => item.to)).toEqual([
      "/repos?grade=A",
      "/repos?grade=B",
      "/repos?grade=C",
      "/repos?grade=D",
      "/repos?grade=F",
    ]);
  });
});

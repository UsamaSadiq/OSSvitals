import { describe, expect, it } from "vitest";
import { change, changeText, pinRows, pointLabel, seriesBars, seriesChart } from "./platformRows";

const HISTORY = [
  { date: "2020-01-01", count: 200 },
  { date: "2026-11-04", count: 150 },
];

describe("platform rows", () => {
  it("labels yearly points by year and today's point as now", () => {
    expect(pointLabel({ date: "2024-01-01", count: 1 }, true)).toBe("2024");
    expect(pointLabel({ date: "2026-11-04", count: 1 }, true)).toBe("Now (2026-11-04)");
    expect(pointLabel({ date: "2026-11-04", count: 1 }, false)).toBe("2026");
    expect(seriesBars(HISTORY, "files").map((bar) => bar.tip)).toEqual(["2020: 200 files", "Now (2026-11-04): 150 files"]);
  });

  it("describes the change from the first point to the last", () => {
    expect(changeText(change(HISTORY))).toBe("down 25% since 2020");
    expect(changeText(change([{ date: "2020-01-01", count: 100 }, { date: "2021-01-01", count: 110 }]))).toBe(
      "up 10% since 2020",
    );
    expect(change(HISTORY.slice(0, 1))).toBeNull();
    expect(change([{ date: "2020-01-01", count: 0 }, ...HISTORY])).toBeNull();
  });

  it("builds no chart without points", () => {
    expect(seriesChart([], "files", "Files")).toBeNull();
    expect(seriesChart(HISTORY, "files", "Files")?.ariaLabel).toBe("2020: 200 files, Now (2026-11-04): 150 files");
  });

  it("keeps unpinned packages as rows", () => {
    expect(pinRows({ a: "1.0", b: null })).toEqual([
      { name: "a", version: "1.0" },
      { name: "b", version: null },
    ]);
    expect(pinRows(undefined)).toEqual([]);
  });
});

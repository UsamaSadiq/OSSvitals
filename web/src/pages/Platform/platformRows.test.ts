import { describe, expect, it } from "vitest";
import type { TrendYear } from "../../data/schemas";
import {
  barChart,
  change,
  changeSince,
  changeText,
  monthLabel,
  organisationName,
  pinRows,
  pointLabel,
  seriesBars,
  seriesChart,
  setAside,
  yearBars,
  yearLabel,
} from "./platformRows";

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

describe("platform trend rows", () => {
  const year = (overrides: Partial<TrendYear>): TrendYear => ({
    year: 2024,
    complete: true,
    through: "2024-12",
    commits: 10,
    authors: 2,
    python_added: 1,
    python_deleted: 1,
    bot_commits: 1,
    mechanical_commits: 4,
    python_lines: 100,
    organisations: [],
    ...overrides,
  });

  it("labels the year in progress with its last month", () => {
    expect(yearLabel(year({}))).toBe("2024");
    expect(yearLabel(year({ year: 2026, complete: false, through: "2026-10" }))).toBe("2026 (to Oct 2026)");
    expect(monthLabel("2020-01")).toBe("Jan 2020");
  });

  it("skips years without a value", () => {
    const bars = yearBars([year({}), year({ year: 2025, python_lines: null })], (row) => row.python_lines, "lines");
    expect(bars).toEqual([{ label: "2024", value: 100, tip: "2024: 100 lines" }]);
    expect(barChart([], "Lines")).toBeNull();
  });

  it("describes a change only between two known, different values", () => {
    expect(changeSince(200, 150, 2020)).toBe("down 25% since 2020");
    expect(changeSince(100, 100, 2020)).toBeNull();
    expect(changeSince(0, 5, 2020)).toBeNull();
    expect(changeSince(null, 5, 2020)).toBeNull();
    expect(changeSince(5, 6, undefined)).toBeNull();
  });

  it("totals the commits set aside", () => {
    expect(setAside([year({}), year({ year: 2025 })])).toEqual({ bots: 2, mechanical: 8 });
  });

  it("names the email buckets", () => {
    expect(organisationName({ name: "axim.org", kind: "domain", authors: 2, commits: 3 })).toBe("axim.org");
    expect(organisationName({ name: "other", kind: "other", domains: 1, authors: 1, commits: 1 })).toBe(
      "Other domains (1 domain)",
    );
    expect(organisationName({ name: "personal", kind: "personal", authors: 1, commits: 1 })).toBe("Personal addresses");
  });
});

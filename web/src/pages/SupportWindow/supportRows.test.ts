import { describe, expect, it } from "vitest";
import type { SupportCycle, SupportProduct } from "../../data/schemas";
import { barFor, byStatus, cycleLabel, declaredText, monthLabel, sourcesText, timeRange, yearTicks } from "./supportRows";

const TODAY = new Date(Date.UTC(2026, 9, 31));
const RANGE = timeRange({ years_back: 1, years_ahead: 1 }, TODAY);

function cycle(overrides: Partial<SupportCycle> = {}): SupportCycle {
  return { cycle: "3.12", start: "2025-01-01", end: "2027-01-01", lts: false, current: false, ...overrides };
}

function product(overrides: Partial<SupportProduct> = {}): SupportProduct {
  return {
    product: "python",
    label: "Python",
    source_note: "https://endoflife.date/python",
    declared: "3.12",
    declared_kind: "declared",
    detected: "3.12",
    detected_url: null,
    current: "3.12",
    current_end: "2028-10-31",
    status: "ok",
    reason: "",
    cycles: [],
    ...overrides,
  };
}

describe("support window rows", () => {
  it("spans from the start of the year back to the end of the year ahead", () => {
    expect(new Date(RANGE.start).toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(new Date(RANGE.end).toISOString()).toBe("2028-01-01T00:00:00.000Z");
    expect(yearTicks(RANGE).map((tick) => tick.year)).toEqual([2025, 2026, 2027]);
  });

  it("places a bar by its dates and clips it to the range", () => {
    const bar = barFor(cycle({ start: "2020-01-01", end: "2026-01-01" }), RANGE);

    expect(bar?.left).toBe(0);
    expect(bar?.width).toBeCloseTo(33.3, 0);
    expect(bar?.openEnded).toBe(false);
  });

  it("runs an open-ended cycle to the end of the range and drops cycles outside it", () => {
    expect(barFor(cycle({ end: null }), RANGE)).toMatchObject({ openEnded: true });
    expect(barFor(cycle({ start: "2019-01-01", end: "2020-01-01" }), RANGE)).toBeNull();
  });

  it("labels cycles for screen readers", () => {
    expect(cycleLabel(product(), cycle({ current: true }))).toBe("Python 3.12, Jan 2025 to Jan 2027, in use");
    expect(monthLabel(null)).toBe("no end date published");
  });

  it("describes how each version is declared", () => {
    expect(declaredText(product({ declared_kind: "follows_tutor", declared: null }))).toBe("Follows Tutor");
    expect(declaredText(product({ declared_kind: "missing", declared: null }))).toBe("Not declared");
    expect(declaredText(product())).toBe("3.12");
  });

  it("puts drift first and names only resolved sources", () => {
    const ordered = byStatus([product({ product: "a", status: "ok" }), product({ product: "b", status: "drift" })]);

    expect(ordered.map((row) => row.product)).toEqual(["b", "a"]);
    expect(sourcesText({ tutor: { repo: "overhangio/tutor", ref: "v22.0.3" }, other: { repo: "x/y", ref: null } })).toBe(
      "overhangio/tutor v22.0.3",
    );
  });
});

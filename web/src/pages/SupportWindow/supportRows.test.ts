import { describe, expect, it } from "vitest";
import type { SupportCycle, SupportProduct } from "../../data/schemas";
import {
  barFor,
  barText,
  byStatus,
  cycleLabel,
  declaredText,
  labelAnchor,
  monthLabel,
  productHue,
  quarterTicks,
  releaseLane,
  sourcesText,
  timeRange,
  yearTicks,
} from "./supportRows";

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
    expect(bar).toMatchObject({ clippedStart: true, clippedEnd: false });
  });

  it("marks a bar cut off by the end of the range apart from one that ends there", () => {
    expect(barFor(cycle({ end: "2030-01-01" }), RANGE)).toMatchObject({ clippedEnd: true, openEnded: false });
    expect(barFor(cycle({ end: "2028-01-01" }), RANGE)).toMatchObject({ clippedEnd: false });
    expect(barFor(cycle({ end: null }), RANGE)).toMatchObject({ clippedEnd: false, openEnded: true });
  });

  it("puts three quarter ticks inside each year", () => {
    const quarters = quarterTicks(RANGE);

    expect(quarters).toHaveLength(9);
    expect(quarters[0]).toBeGreaterThan(0);
    expect(quarters[2]).toBeLessThan(yearTicks(RANGE)[1]!.left);
  });

  it("anchors a label to the bar end only near the right edge", () => {
    const bar = { width: 5, openEnded: false, clippedStart: false, clippedEnd: false };

    expect(labelAnchor({ ...bar, left: 10 })).toBe("start");
    expect(labelAnchor({ ...bar, left: 75 })).toBe("start");
    expect(labelAnchor({ ...bar, left: 85 })).toBe("end");
  });

  it("writes the product and version on the bar, with the end date for the one in use", () => {
    expect(barText(product(), cycle())).toBe("Python 3.12");
    expect(barText(product(), cycle({ current: true }))).toBe("Python 3.12 · in use, ends Jan 2027");
    expect(barText(product(), cycle({ end: null }))).toBe("Python 3.12 · no end date");
    expect(barText(product({ product: "open_edx", label: "Open edX" }), cycle({ cycle: "Verawood" }))).toBe("Verawood");
    expect(barText(product({ product: "open_edx", label: "Open edX" }), cycle({ cycle: "Verawood", current: true }))).toBe(
      "Verawood",
    );
  });

  it("staggers releases across three lanes and cycles product hues", () => {
    expect([0, 1, 2, 3].map(releaseLane)).toEqual([0, 1, 2, 0]);
    expect(productHue(0)).toBe("var(--cat-1)");
    expect(productHue(4)).toBe("var(--cat-1)");
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

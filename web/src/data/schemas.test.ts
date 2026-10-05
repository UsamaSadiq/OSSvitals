import { describe, expect, it } from "vitest";
import { z } from "zod";
import { metadata, overviewFixture } from "./fixtures";
import { parseView } from "./parse";

function withoutKey(record: object, key: string): object {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

describe("overview schema", () => {
  it("accepts the section 5 fields", () => {
    expect(parseView("overview", overviewFixture()).avg_letter).toBe("B");
  });

  it("accepts a missing baseline", () => {
    const noBaseline = overviewFixture({ kpi_baseline: null, kpi_baseline_date: null, kpi_deltas: null });
    expect(parseView("overview", noBaseline).kpi_deltas).toBeNull();
  });

  it.each(["avg_letter", "kpi_deltas", "highlights", "gainers", "losers"])("requires %s", (field) => {
    expect(() => parseView("overview", withoutKey(overviewFixture(), field))).toThrow(
      new RegExp(`^overview\\.json: .*${field}`),
    );
  });
});

describe("history schema", () => {
  const history = {
    metadata: metadata("history"),
    dates: ["2026-08-31"],
    org_average: [["2026-08-31", 70]],
    repos: { "openedx/a": [["2026-08-31", 70, "B"]] },
  };

  it("accepts history written before grade counts existed", () => {
    expect(parseView("history", history).grade_counts).toBeUndefined();
  });

  it("accepts per-snapshot grade counts", () => {
    const counts = [{ A: 0, B: 1, C: 0, D: 0, F: 0 }];
    expect(parseView("history", { ...history, grade_counts: counts }).grade_counts).toEqual(counts);
  });

  it("rejects a grade count missing a letter", () => {
    expect(() => parseView("history", { ...history, grade_counts: [{ A: 0, B: 1, C: 0, D: 0 }] })).toThrow(/F/);
  });
});

describe("zod runtime config", () => {
  it("runs jitless so the eval probe never trips the CSP", () => {
    expect(z.config().jitless).toBe(true);
  });
});

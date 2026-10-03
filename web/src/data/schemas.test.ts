import { describe, expect, it } from "vitest";
import { z } from "zod";
import { overviewFixture } from "./fixtures";
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

describe("zod runtime config", () => {
  it("runs jitless so the eval probe never trips the CSP", () => {
    expect(z.config().jitless).toBe(true);
  });
});

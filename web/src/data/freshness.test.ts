import { describe, expect, it } from "vitest";
import { metadata, metaFixture } from "./fixtures";
import { freshnessLevel, freshnessOf, snapshotAgeHours, snapshotDateOf } from "./freshness";

const thresholds = { staleHours: 48, criticalHours: 168 };
const NOW = new Date("2026-10-02T13:00:00Z");

function metaWithSnapshot(snapshot_timestamp: string | null) {
  return metaFixture({ metadata: metadata("dashboard/config", { snapshot_timestamp }) });
}

describe("freshnessLevel", () => {
  it.each([
    [0, "fresh"],
    [48, "fresh"],
    [72, "stale"],
    [168, "stale"],
    [192, "critical"],
  ] as const)("classifies %ih as %s", (ageHours, level) => {
    expect(freshnessLevel(ageHours, thresholds)).toBe(level);
  });
});

describe("snapshotAgeHours", () => {
  it("counts whole UTC days, as the Streamlit banner does", () => {
    expect(snapshotAgeHours("2026-10-02", NOW)).toBe(0);
    expect(snapshotAgeHours("2026-10-01", new Date("2026-10-02T00:05:00Z"))).toBe(24);
    expect(snapshotAgeHours("2026-09-28", NOW)).toBe(96);
  });

  it("never goes negative for a future snapshot", () => {
    expect(snapshotAgeHours("2026-10-05", NOW)).toBe(0);
  });
});

describe("snapshotDateOf", () => {
  it("reads the date from dates and timestamps", () => {
    expect(snapshotDateOf("2026-10-02")).toBe("2026-10-02");
    expect(snapshotDateOf("2026-10-02T04:00:00+00:00")).toBe("2026-10-02");
  });

  it("returns null when there is no readable date", () => {
    expect(snapshotDateOf(null)).toBeNull();
    expect(snapshotDateOf("")).toBeNull();
    expect(snapshotDateOf("yesterday")).toBeNull();
  });
});

describe("freshnessOf", () => {
  it("is fresh within the stale threshold", () => {
    expect(freshnessOf(metaWithSnapshot("2026-09-30"), NOW)).toEqual({ level: "fresh" });
  });

  it("is stale past the stale threshold", () => {
    expect(freshnessOf(metaWithSnapshot("2026-09-29"), NOW)).toEqual({
      level: "stale",
      ageHours: 72,
      snapshotDate: "2026-09-29",
      staleThresholdHours: 48,
    });
  });

  it("is critical past the critical threshold", () => {
    expect(freshnessOf(metaWithSnapshot("2026-09-20"), NOW)).toMatchObject({ level: "critical", ageHours: 288 });
  });

  it("is unknown without a snapshot timestamp", () => {
    expect(freshnessOf(metaWithSnapshot(null), NOW)).toEqual({ level: "unknown" });
  });
});

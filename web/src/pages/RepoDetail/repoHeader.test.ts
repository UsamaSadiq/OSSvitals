import { describe, expect, it } from "vitest";
import { githubUrl, headerChips, pushDate } from "./repoFacts";
import type { RepoRecord } from "./repoDetailData";
import { compositeSeries, repoTrend, trendLabel, type HistoryPoint } from "./repoTrend";

function record(overrides: Partial<RepoRecord> = {}): RepoRecord {
  return {
    repo_name: "openedx/alpha",
    score_composite: 70,
    score_letter: "B",
    checks: {},
    category_stats: {},
    owner_handles: [],
    ...overrides,
  };
}

describe("header chips", () => {
  it("lists tier, owner, lifecycle and last push in that order", () => {
    const chips = headerChips(
      record({
        repo_tier: "standard",
        "ownership.owner_name": " Axim ",
        "ownership.lifecycle": "production",
        "github.last_push": "2026-08-17T21:36:36Z",
      }),
    );
    expect(chips).toEqual([
      { id: "tier", label: "Tier", value: "standard" },
      { id: "owner", label: "Owner", value: "Axim", to: "/ownership_views?owner=axim" },
      { id: "lifecycle", label: "Lifecycle", value: "production" },
      { id: "push", label: "Last push", value: "2026-08-17" },
    ]);
  });

  it("skips missing and blank values", () => {
    expect(headerChips(record({ repo_tier: null, "ownership.owner_name": "  ", "github.last_push": null }))).toEqual([]);
    expect(headerChips(record())).toEqual([]);
  });

  it("reads the date from a space-separated or ISO timestamp", () => {
    expect(pushDate("2026-08-17 21:36:36")).toBe("2026-08-17");
    expect(pushDate("not a date")).toBeNull();
    expect(pushDate(undefined)).toBeNull();
  });

  it("links to the repository on GitHub", () => {
    expect(githubUrl("openedx/alpha")).toBe("https://github.com/openedx/alpha");
  });
});

describe("repo composite trend", () => {
  const points: HistoryPoint[] = [
    ["2026-08-01", 50, "C"],
    ["2026-09-10", null, null],
    ["2026-09-15", 60, "B"],
    ["2026-10-01", 58.5, "C"],
  ];

  it("drops snapshots without a composite", () => {
    expect(compositeSeries(points)).toEqual([
      ["2026-08-01", 50],
      ["2026-09-15", 60],
      ["2026-10-01", 58.5],
    ]);
    expect(compositeSeries(undefined)).toEqual([]);
  });

  it("measures the delta against the first point in the 30-day window", () => {
    const trend = repoTrend(points);
    expect(trend?.since).toBe("2026-09-15");
    expect(trend?.delta).toEqual({ text: "-1.5", direction: "down", tone: "bad" });
    expect(trend && trendLabel(trend)).toBe("-1.5 since 2026-09-15");
    expect(trend?.chart.ariaLabel).toBe("Composite score over 2 snapshots, from 60.0 to 58.5");
  });

  it("reports no change for a flat series", () => {
    const trend = repoTrend([
      ["2026-09-15", 60, "B"],
      ["2026-10-01", 60, "B"],
    ]);
    expect(trend?.delta).toEqual({ text: "no change", direction: "flat", tone: "neutral" });
  });

  it("needs two points in the window", () => {
    expect(repoTrend(points.slice(0, 1))).toBeNull();
    expect(repoTrend(undefined)).toBeNull();
    expect(repoTrend(points, 5)).toBeNull();
  });
});

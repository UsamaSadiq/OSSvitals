import { describe, expect, it } from "vitest";
import { metadata } from "../../data/fixtures";
import type { PlatformView } from "../../data/schemas";
import { briefPoints } from "./platformBrief";

function trendYear(year: number, complete: boolean, pythonLines: number) {
  return {
    year,
    complete,
    through: complete ? `${year}-12` : `${year}-10`,
    commits: 0,
    authors: 0,
    python_added: 0,
    python_deleted: 0,
    bot_commits: 0,
    mechanical_commits: 0,
    python_lines: pythonLines,
    organisations: [{ name: "example.org", kind: "domain" as const, authors: 5, commits: 9 }],
  };
}

function view(overrides: Partial<PlatformView> = {}): PlatformView {
  return {
    metadata: metadata("openedx-platform source files and git history on GitHub"),
    available: true,
    modularization: {
      available: true,
      summary: { blocks: 8, extracted: 8, percent_extracted: 100 },
      legacy_frontend: {
        history: [
          { date: "2020-01-01", count: 2515 },
          { date: "2026-11-05", count: 2004 },
        ],
      },
    },
    trends: {
      available: true,
      summary: {
        first_year: 2020,
        latest_year: 2025,
        first: { commits: 2590, authors: 221, python_lines: 290775 },
        latest: { commits: 1097, authors: 183, python_lines: 351010 },
      },
      years: [trendYear(2020, true, 290775), trendYear(2025, true, 351010), trendYear(2026, false, 356721)],
    },
    extension_points: {
      available: true,
      summary: {
        filters: { first: { release: "nutmeg", count: 9 }, now: 43 },
        events: { first: { release: "maple", count: 9 }, now: 75 },
        plugin_slots: { first: { release: "redwood", count: 10 }, now: 99 },
      },
    },
    upgrade_cost: {
      available: true,
      summary: { releases: 9, median_days_between: 186, deprecations: 68, open_deprecations: 18 },
      releases: [
        {
          release: "verawood",
          date: "2026-07-29",
          days_since_previous: 195,
          deprecations: { total: 7, open: 4, closed: 3 },
          breaking_changes: 4,
          notes_url: null,
        },
        {
          release: "willow",
          date: null,
          days_since_previous: null,
          deprecations: { total: 1, open: 1, closed: 0 },
          breaking_changes: 0,
          notes_url: null,
        },
      ],
    },
    ...overrides,
  };
}

describe("platform brief", () => {
  it("states one headline per section, linked to the section", () => {
    expect(briefPoints(view())).toEqual([
      {
        topic: "Modularization",
        href: "#modularization",
        text: "8 of 8 built-in XBlocks now ship as a separate package. Legacy frontend files are down 20% since 2020.",
      },
      {
        topic: "Stability",
        href: "#stability",
        text: "1,097 commits by 183 authors in 2025, commits down 58% since 2020. 356,721 lines of Python outside tests, up 23% since 2020.",
      },
      {
        topic: "Customising without forking",
        href: "#extension-points",
        text: "43 filters, 75 events and 99 frontend plugin slots. Plugin slots are up 890% since Redwood.",
      },
      {
        topic: "Upgrade cost",
        href: "#upgrade-cost",
        text: "A named release every 186 days (median). Verawood drops 7 deprecated features and lists 4 breaking changes. 18 deprecations are still open.",
      },
    ]);
  });

  it("names no contributor organisation", () => {
    expect(JSON.stringify(briefPoints(view()))).not.toContain("example.org");
  });

  it("leaves out sections that are missing or not collected yet", () => {
    const points = briefPoints(
      view({ trends: { available: false }, extension_points: undefined, upgrade_cost: { available: false } }),
    );
    expect(points.map((point) => point.topic)).toEqual(["Modularization"]);
    expect(briefPoints(view({ modularization: { available: false }, trends: undefined, extension_points: undefined, upgrade_cost: undefined }))).toEqual([]);
  });

  it("skips an upgrade point with nothing to say", () => {
    const points = briefPoints(view({ upgrade_cost: { available: true, summary: {}, releases: [] } }));
    expect(points.map((point) => point.topic)).not.toContain("Upgrade cost");
  });
});

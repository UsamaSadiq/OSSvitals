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
      extracted_package: "xblocks-contrib",
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

function upgradeRelease(name: string, date: string | null, total: number, open: number, breaking: number | null) {
  return {
    release: name,
    date,
    days_since_previous: null,
    deprecations: { total, open, closed: total - open },
    breaking_changes: breaking,
    notes_url: null,
  };
}

function upgrade(releases: ReturnType<typeof upgradeRelease>[], open: number) {
  return {
    available: true,
    summary: { releases: releases.length, median_days_between: 186, deprecations: 0, open_deprecations: open },
    releases,
  };
}

function upgradeText(releases: ReturnType<typeof upgradeRelease>[], open: number): string | undefined {
  return briefPoints(view({ upgrade_cost: upgrade(releases, open) })).find((point) => point.topic === "Upgrade cost")?.text;
}

describe("platform brief", () => {
  it("states one headline per section, linked to the section", () => {
    expect(briefPoints(view())).toEqual([
      {
        topic: "Modularization",
        href: "#modularization",
        text: "8 of the 8 built-in XBlocks have moved out of the platform into xblocks-contrib. Legacy frontend files are down 20% since 2020.",
        headline: { figure: "8 of 8", label: "built-in XBlocks moved out", verdict: "good" },
      },
      {
        topic: "Stability",
        href: "#stability",
        text: "1,097 commits by 183 authors in 2025, commits down 58% since 2020. 356,721 lines of Python outside tests and migrations, up 23% since 2020.",
        headline: { figure: "1,097", label: "commits in 2025", verdict: "good" },
      },
      {
        topic: "Extension points",
        href: "#extension-points",
        text: "Ways to customise the platform without forking it: 43 filters, 75 events and 99 frontend plugin slots. Plugin slots went from 10 at Redwood to 99.",
        headline: { figure: "99", label: "frontend plugin slots", verdict: "good" },
      },
      {
        topic: "Upgrade cost",
        href: "#upgrade-cost",
        text: "A named release every 186 days (median). 7 deprecations name Verawood as the first release without them (4 still open), and its release notes list 4 breaking changes. 18 deprecations are still open.",
        headline: { figure: "186 days", label: "between releases (median)", verdict: "watch" },
      },
    ]);
  });

  it("uses singular forms for one", () => {
    expect(upgradeText([upgradeRelease("sumac", "2024-12-13", 1, 1, 1)], 1)).toBe(
      "A named release every 186 days (median). 1 deprecation names Sumac as the first release without it (1 still open), and its release notes list 1 breaking change. 1 deprecation is still open.",
    );
  });

  it("skips the newest release while it has no cost yet, and never states a zero", () => {
    const releases = [upgradeRelease("verawood", "2026-07-29", 0, 0, 4), upgradeRelease("willow", "2027-01-15", 0, 0, 0)];
    expect(upgradeText(releases, 0)).toBe("A named release every 186 days (median). Verawood's release notes list 4 breaking changes.");
  });

  it("leaves out unknown counts instead of printing zero", () => {
    const points = briefPoints(
      view({
        modularization: { available: true, summary: { blocks: 8 } },
        extension_points: {
          available: true,
          summary: { filters: { first: null, now: null }, events: { first: null, now: 75 } },
        },
      }),
    );
    expect(points.map((entry) => entry.topic)).not.toContain("Modularization");
    expect(points.find((entry) => entry.topic === "Extension points")?.text).toBe(
      "Ways to customise the platform without forking it: 75 events.",
    );
  });

  it("says so when no XBlock has moved yet", () => {
    const points = briefPoints(view({ modularization: { available: true, summary: { blocks: 8, extracted: 0 } } }));
    expect(points[0]?.text).toBe("None of the 8 built-in XBlocks has moved out of the platform yet.");
  });

  it("names no contributor organisation", () => {
    expect(JSON.stringify(briefPoints(view()))).not.toContain("example.org");
  });

  it("leaves out sections that are missing or not collected yet", () => {
    const points = briefPoints(
      view({ trends: { available: false }, extension_points: undefined, upgrade_cost: { available: false } }),
    );
    expect(points.map((entry) => entry.topic)).toEqual(["Modularization"]);
    expect(
      briefPoints(
        view({ modularization: { available: false }, trends: undefined, extension_points: undefined, upgrade_cost: undefined }),
      ),
    ).toEqual([]);
  });

  it("skips an upgrade point with nothing to say", () => {
    const points = briefPoints(view({ upgrade_cost: { available: true, summary: {}, releases: [] } }));
    expect(points.map((entry) => entry.topic)).not.toContain("Upgrade cost");
  });
});

describe("platform brief verdicts", () => {
  const verdictOf = (overrides: Partial<PlatformView>, topic: string) =>
    briefPoints(view(overrides)).find((entry) => entry.topic === topic)?.headline?.verdict;

  it("reads extraction progress", () => {
    expect(verdictOf({ modularization: { available: true, summary: { blocks: 8, extracted: 5 } } }, "Modularization")).toBe("watch");
    expect(verdictOf({ modularization: { available: true, summary: { blocks: 8, extracted: 0 } } }, "Modularization")).toBe("concern");
  });

  it("watches rising commits, shrinking extension points and open deprecations", () => {
    const rising = {
      available: true,
      summary: {
        first_year: 2020,
        latest_year: 2025,
        first: { commits: 100, authors: 10, python_lines: 1 },
        latest: { commits: 150, authors: 10, python_lines: 1 },
      },
      years: [],
    };
    expect(verdictOf({ trends: rising }, "Stability")).toBe("watch");
    const shrinking = { available: true, summary: { plugin_slots: { first: { release: "teak", count: 50 }, now: 40 } } };
    expect(verdictOf({ extension_points: shrinking }, "Extension points")).toBe("watch");
    expect(upgradeText([], 0)).toBe("A named release every 186 days (median).");
    expect(verdictOf({ upgrade_cost: upgrade([], 0) }, "Upgrade cost")).toBe("good");
  });
});

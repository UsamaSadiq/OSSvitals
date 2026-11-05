import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type {
  ExtensionPoints,
  ExtensionRelease,
  Modularization,
  PlatformTrends,
  PlatformView,
  TrendYear,
  UpgradeCost,
  UpgradeRelease,
  ViewName,
} from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { renderRoute } from "../../test/renderRoute";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready<Name extends ViewName>(data: unknown): ViewState<Name> {
  return { status: "ready", data, error: undefined } as ViewState<Name>;
}

const TOGGLES_URL = "https://github.com/openedx/openedx-platform/blob/master/openedx/envs/common.py";

function modularization(overrides: Partial<Modularization> = {}): Modularization {
  return {
    available: true,
    collected_at: "2026-11-04T11:24:51+00:00",
    repo: "openedx/openedx-platform",
    ref: "master",
    toggles_url: TOGGLES_URL,
    extracted_package: "xblocks-contrib",
    pins: { "openedx-core": "1.21.0", "openedx-events": null },
    pins_url: "https://github.com/openedx/openedx-platform/blob/master/requirements/edx/base.txt",
    legacy_frontend: {
      history: [
        { date: "2020-01-01", count: 2500 },
        { date: "2026-01-01", count: 2200 },
        { date: "2026-11-04", count: 2000 },
      ],
    },
    summary: { blocks: 2, extracted: 1, percent_extracted: 50 },
    blocks: [
      { block: "Video", toggle: "VIDEO", status: "built_in" },
      { block: "Word Cloud", toggle: "WORD_CLOUD", status: "extracted" },
    ],
    ...overrides,
  };
}

function snapshot(overrides: Partial<PlatformView> = {}): PlatformView {
  return {
    metadata: metadata("openedx-platform source files and git history on GitHub"),
    available: true,
    modularization: modularization(),
    ...overrides,
  };
}

function setView(view: PlatformView) {
  views.current = { platform: ready(view) };
}

beforeEach(() => setView(snapshot()));

describe("Platform page", () => {
  it("shows the info empty state before any collector has published", async () => {
    setView(snapshot({ available: false, modularization: { available: false } }));
    renderRoute("/platform");

    expect(await screen.findByText("No platform snapshot yet.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Modularization" })).not.toBeInTheDocument();
  });

  it("summarises extraction and the legacy frontend trend", async () => {
    renderRoute("/platform");

    expect(await screen.findByRole("heading", { level: 1, name: "Platform" })).toBeInTheDocument();
    expect(document.title).toBe("Platform · Open edX Repo Health");
    expect(screen.getByRole("group", { name: "Built-in XBlocks extracted" })).toHaveTextContent("1 of 2");
    const legacy = screen.getByRole("group", { name: "Legacy frontend files" });
    expect(legacy).toHaveTextContent("2,000");
    expect(legacy).toHaveTextContent("down 20% since 2020");
    expect(screen.getByRole("link", { name: "openedx/envs/common.py" })).toHaveAttribute("href", TOGGLES_URL);
  });

  it("lists each block's status and every pinned package", async () => {
    renderRoute("/platform");

    const blocks = await screen.findByRole("table", { name: "Core XBlocks" });
    expect(within(blocks).getByRole("row", { name: /Video/ })).toHaveTextContent("Still built in");
    expect(within(blocks).getByRole("row", { name: /Word Cloud/ })).toHaveTextContent("USE_EXTRACTED_WORD_CLOUD_BLOCK");
    const pins = screen.getByRole("table", { name: "Extracted packages the platform pins" });
    expect(within(pins).getByRole("row", { name: /openedx-events/ })).toHaveTextContent("Not pinned");
  });
});

function year(overrides: Partial<TrendYear>): TrendYear {
  return {
    year: 2024,
    complete: true,
    through: "2024-12",
    commits: 100,
    authors: 20,
    python_added: 1000,
    python_deleted: 500,
    bot_commits: 3,
    mechanical_commits: 2,
    python_lines: 300000,
    organisations: [],
    ...overrides,
  };
}

function trends(overrides: Partial<PlatformTrends> = {}): PlatformTrends {
  return {
    available: true,
    collected_at: "2026-11-01T08:58:00+00:00",
    repo: "openedx/openedx-platform",
    ref: "master",
    since: "2024-01",
    through: "2026-10",
    mechanical_max_files: 500,
    summary: {
      first_year: 2024,
      latest_year: 2025,
      first: { commits: 200, authors: 40, python_lines: 300000 },
      latest: { commits: 150, authors: 30, python_lines: 330000 },
    },
    years: [
      year({ year: 2024, commits: 200, authors: 40, python_lines: 300000 }),
      year({
        year: 2025,
        commits: 150,
        authors: 30,
        python_lines: 330000,
        organisations: [
          { name: "axim.org", kind: "domain", authors: 5, commits: 90 },
          { name: "other", kind: "other", domains: 4, authors: 4, commits: 9 },
          { name: "noreply", kind: "noreply", authors: 12, commits: 40 },
        ],
      }),
      year({ year: 2026, complete: false, through: "2026-10", commits: 90, authors: 25, python_lines: 345000 }),
    ],
    months: [],
    ...overrides,
  };
}

describe("Platform stability section", () => {
  it("is absent when the view has no trends", async () => {
    renderRoute("/platform");

    expect(await screen.findByRole("heading", { level: 2, name: "Modularization" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Stability" })).not.toBeInTheDocument();
  });

  it("shows an empty state before the first monthly run", async () => {
    setView(snapshot({ trends: { available: false } }));
    renderRoute("/platform");

    const heading = await screen.findByRole("heading", { name: "Stability" });
    expect(heading.closest("section")).toHaveTextContent("Published monthly by the collect-maintenance workflow.");
  });

  it("compares the latest complete year with the first and lists organisations", async () => {
    setView(snapshot({ trends: trends() }));
    renderRoute("/platform");

    const commits = await screen.findByRole("group", { name: "Commits in 2025" });
    expect(commits).toHaveTextContent("150");
    expect(commits).toHaveTextContent("down 25% since 2024");
    expect(screen.getByRole("group", { name: "Authors in 2025" })).toHaveTextContent("down 25% since 2024");
    const lines = screen.getByRole("group", { name: "Python lines" });
    expect(lines).toHaveTextContent("345,000");
    expect(lines).toHaveTextContent("up 15% since 2024");
    expect(screen.getByText(/Jan 2024 to Oct 2026\. Left out: merge commits, 9 bot commits and 6 changes/)).toBeInTheDocument();

    const byYear = screen.getByRole("table", { name: "Platform activity by year" });
    expect(within(byYear).getByRole("row", { name: /2026 \(to Oct 2026\)/ })).toHaveTextContent("345,000");
    const organisations = screen.getByRole("table", { name: "Contributor organisations in 2025" });
    expect(within(organisations).getByRole("row", { name: /axim\.org/ })).toHaveTextContent("90");
    expect(within(organisations).getByRole("row", { name: /Other domains \(4 domains\)/ })).toBeInTheDocument();
    expect(within(organisations).getByRole("row", { name: /GitHub private addresses/ })).toBeInTheDocument();
  });
});

function release(name: string, date: string, filters: number | null, events: number, slots: Record<string, number>): ExtensionRelease {
  const total = Object.values(slots).reduce((sum, value) => sum + value, 0);
  return {
    release: name,
    ref: name === "current" ? "master" : `release/${name}.1`,
    date,
    filters: filters === null ? { version: null, count: null } : { version: "2.1.0", count: filters },
    events: { version: "10.5.0", count: events },
    plugin_slots: { total, repos: slots },
  };
}

function extensionPoints(overrides: Partial<ExtensionPoints> = {}): ExtensionPoints {
  return {
    available: true,
    collected_at: "2026-11-05T08:58:00+00:00",
    packages: { filters: "openedx-filters", events: "openedx-events" },
    slots_roots: ["src/plugin-slots", "src/slots"],
    summary: {
      filters: { first: { release: "nutmeg", count: 9 }, now: 43 },
      events: { first: { release: "maple", count: 9 }, now: 75 },
      plugin_slots: { first: { release: "redwood", count: 10 }, now: 90 },
    },
    releases: [
      release("maple", "2021-12-16", null, 9, {}),
      release("redwood", "2024-06-17", 19, 50, { "openedx/frontend-app-learning": 4, "openedx/frontend-app-authoring": 6 }),
      release("current", "2026-11-05", 43, 75, { "openedx/frontend-app-learning": 35, "openedx/frontend-app-authoring": 55 }),
    ],
    ...overrides,
  };
}

describe("Platform extension points section", () => {
  it("is absent when the view has no extension points", async () => {
    renderRoute("/platform");

    expect(await screen.findByRole("heading", { level: 2, name: "Modularization" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Extension points" })).not.toBeInTheDocument();
  });

  it("compares each count now with the first release that had it", async () => {
    setView(snapshot({ extension_points: extensionPoints() }));
    renderRoute("/platform");

    const filters = await screen.findByRole("group", { name: "Filters" });
    expect(filters).toHaveTextContent("43");
    expect(filters).toHaveTextContent("up 378% since Nutmeg");
    expect(screen.getByRole("group", { name: "Events" })).toHaveTextContent("up 733% since Maple");
    expect(screen.getByRole("group", { name: "Plugin slots" })).toHaveTextContent("up 800% since Redwood");

    const table = screen.getByRole("table", { name: "Extension points by release" });
    expect(within(table).getByRole("row", { name: /Maple \(2021-12-16\)/ })).toHaveTextContent("Not pinned");
    const now = within(table).getByRole("row", { name: /Now \(2026-11-05\)/ });
    expect(now).toHaveTextContent("43 (2.1.0)");
    expect(now).toHaveTextContent("90");
  });

  it("shows an empty state before the first run", async () => {
    setView(snapshot({ extension_points: { available: false } }));
    renderRoute("/platform");

    const heading = await screen.findByRole("heading", { name: "Extension points" });
    expect(heading.closest("section")).toHaveTextContent("Published daily by the collect-maintenance workflow.");
  });
});

function upgradeRow(name: string, date: string | null, days: number | null, total: number, open: number, breaking: number | null): UpgradeRelease {
  return {
    release: name,
    date,
    days_since_previous: days,
    deprecations: { total, open, closed: total - open },
    breaking_changes: breaking,
    notes_url: breaking === null ? null : `https://github.com/openedx/docs.openedx.org/blob/main/source/community/release_notes/${name}/dev_op_release_notes.rst`,
  };
}

function upgradeCost(overrides: Partial<UpgradeCost> = {}): UpgradeCost {
  return {
    available: true,
    collected_at: "2026-11-05T08:58:00+00:00",
    deprecations_url: "https://github.com/openedx/public-engineering/issues?q=label%3Adepr",
    unscheduled: { total: 60, open: 7, closed: 53 },
    earlier: { total: 0, open: 0, closed: 0 },
    withdrawn: { total: 3, open: 0, closed: 3 },
    summary: { releases: 2, median_days_between: 206, deprecations: 21, open_deprecations: 16 },
    releases: [
      upgradeRow("teak", "2025-06-23", null, 4, 0, 3),
      upgradeRow("ulmo", "2026-01-15", 206, 13, 4, 2),
      upgradeRow("willow", null, null, 1, 1, null),
    ],
    ...overrides,
  };
}

describe("Platform upgrade cost section", () => {
  it("is absent when the view has no upgrade cost", async () => {
    renderRoute("/platform");

    expect(await screen.findByRole("heading", { level: 2, name: "Modularization" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Upgrade cost" })).not.toBeInTheDocument();
  });

  it("summarises cadence and deprecations and links each release's notes", async () => {
    setView(snapshot({ upgrade_cost: upgradeCost() }));
    renderRoute("/platform");

    expect(await screen.findByRole("group", { name: "Time between releases" })).toHaveTextContent("206 days");
    expect(screen.getByRole("group", { name: "Open deprecations" })).toHaveTextContent("16");
    expect(screen.getByText(/60 name no release yet \(7 of them open\); 3 were withdrawn and are not counted/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "DEPR tickets" })).toHaveAttribute("href", expect.stringContaining("label%3Adepr"));

    const table = screen.getByRole("table", { name: "Upgrade cost by release" });
    const ulmo = within(table).getByRole("row", { name: /Ulmo \(2026-01-15\)/ });
    expect(within(ulmo).getByRole("link", { name: "2" })).toHaveAttribute("href", expect.stringContaining("/ulmo/"));
    expect(within(table).getByRole("row", { name: /Willow \(not cut yet\)/ })).toHaveTextContent("Unknown");
  });

  it("shows an empty state before the first run", async () => {
    setView(snapshot({ upgrade_cost: { available: false } }));
    renderRoute("/platform");

    const heading = await screen.findByRole("heading", { name: "Upgrade cost" });
    expect(heading.closest("section")).toHaveTextContent("Published daily by the collect-maintenance workflow.");
  });
});

describe("Platform brief", () => {
  it("leads the page with linked headlines", async () => {
    setView(snapshot({ trends: trends(), extension_points: extensionPoints(), upgrade_cost: upgradeCost() }));
    renderRoute("/platform");

    const brief = (await screen.findByRole("heading", { name: "In brief" })).closest("section");
    expect(brief).toHaveAttribute("id", "brief");
    const cards = within(brief as HTMLElement);
    expect(cards.getByRole("link", { name: "Details on stability" })).toHaveAttribute("href", "#stability");
    expect(cards.getByRole("link", { name: "Details on upgrade cost" })).toHaveAttribute("href", "#upgrade-cost");
    expect(brief).toHaveTextContent("1 of the 2 built-in XBlocks has moved out of the platform into xblocks-contrib");
    const modularization = cards.getByRole("heading", { level: 3, name: "Modularization" }).closest("li") as HTMLElement;
    expect(modularization).toHaveTextContent("1 of 2 built-in XBlocks moved out");
    expect(within(modularization).getByText("Watch")).toHaveClass("badge--warn");
  });

  it("links to each section from a nav under the title", async () => {
    setView(snapshot({ trends: trends() }));
    renderRoute("/platform");

    const nav = await screen.findByRole("navigation", { name: "Sections on this page" });
    expect(within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["#modularization", "#stability"]);
  });
});

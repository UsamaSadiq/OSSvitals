import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type { Modularization, PlatformTrends, PlatformView, TrendYear, ViewName } from "../../data/schemas";
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
    const pins = screen.getByRole("table", { name: "Extracted packages" });
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

    expect(await screen.findByRole("heading", { name: "Modularization" })).toBeInTheDocument();
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

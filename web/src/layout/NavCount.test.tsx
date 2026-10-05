import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../data/fixtures";
import type { AtRiskView } from "../data/schemas";
import { shownAtRiskCount } from "../pages/AtRisk/atRiskDefaults";
import { renderRoute, withMaintainerViews } from "../test/renderRoute";
import { countText, REPOSITORIES } from "./navCounts";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready(data: unknown) {
  return { status: "ready", data, error: undefined };
}

type AtRiskRow = AtRiskView["records"][number];

function atRiskRow(repo_name: string, production_or_release: boolean): AtRiskRow {
  return {
    repo_name,
    owner_status: "needs maintainer",
    score_composite: 40,
    score_letter: "C",
    reasons: "activity score below 40",
    production_or_release,
  };
}

function atRiskView(overrides: Partial<AtRiskView> = {}): AtRiskView {
  return {
    metadata: metadata("at_risk"),
    enabled: true,
    has_owner_data: true,
    has_lifecycle_data: true,
    records: [atRiskRow("openedx/a", true), atRiskRow("openedx/b", true), atRiskRow("openedx/c", false)],
    ...overrides,
  };
}

function attentionRecord(repo_name: string) {
  return { repo_name, repo_tier: "critical", score_composite: 10, score_letter: "F", reasons: "grade F" };
}

beforeEach(() => {
  views.current = {
    attention: ready({ metadata: metadata("attention"), records: ["a", "b", "c"].map((name) => attentionRecord(`openedx/${name}`)) }),
    at_risk: ready(atRiskView()),
    upgrades: ready({
      metadata: metadata("upgrades"),
      upgrade_jobs: { collected_at: null, states: { failing: 45, healthy: 30 }, records: [] },
      waves: [],
      redundant_prs: null,
    }),
  };
});

function nav() {
  return screen.getByRole("navigation", { name: "Pages" });
}

describe("nav counts", () => {
  it("gives each counted page a badge with accessible text", async () => {
    renderRoute("/", withMaintainerViews(true));

    expect(await within(nav()).findByRole("link", { name: "Needing Attention, 3 repositories" })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: "At Risk, 2 repositories" })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: "Upgrades, 45 failing upgrade jobs" })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: "Overview" })).toBeInTheDocument();
  });

  it("does not badge a page whose count is zero or missing", async () => {
    views.current = {
      ...views.current,
      attention: ready({ metadata: metadata("attention"), records: [] }),
      upgrades: ready({ metadata: metadata("upgrades"), upgrade_jobs: null, waves: [], redundant_prs: null }),
    };
    renderRoute("/", withMaintainerViews(true));

    await within(nav()).findByRole("link", { name: "At Risk, 2 repositories" });
    expect(within(nav()).getByRole("link", { name: "Needing Attention" })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: "Upgrades" })).toBeInTheDocument();
  });

  it("shows no badge while the counts are loading", () => {
    views.current = {};
    renderRoute("/", withMaintainerViews(true));
    expect(within(nav()).getByRole("link", { name: "Needing Attention" })).toBeInTheDocument();
  });

  it("matches the rows the At Risk page shows by default", async () => {
    renderRoute("/at_risk", withMaintainerViews(true));

    const table = await screen.findByRole("table");
    const bodyRows = within(table).getAllByRole("row").length - 1;
    expect(bodyRows).toBe(2);
    expect(within(nav()).getByRole("link", { name: `At Risk, ${countText(bodyRows, REPOSITORIES)}` })).toBeInTheDocument();
  });
});

describe("shownAtRiskCount", () => {
  it("counts production repos when lifecycle data exists", () => {
    expect(shownAtRiskCount(atRiskView())).toBe(2);
  });

  it("counts every record without lifecycle data", () => {
    expect(shownAtRiskCount(atRiskView({ has_lifecycle_data: false }))).toBe(3);
  });

  it("has no count when the view is off or has no owner data", () => {
    expect(shownAtRiskCount(atRiskView({ enabled: false }))).toBeNull();
    expect(shownAtRiskCount(atRiskView({ has_owner_data: false }))).toBeNull();
  });
});

describe("countText", () => {
  it("uses the singular for one", () => {
    expect(countText(1, REPOSITORIES)).toBe("1 repository");
    expect(countText(11, REPOSITORIES)).toBe("11 repositories");
  });
});

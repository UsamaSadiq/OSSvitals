import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata, overviewFixture } from "../../data/fixtures";
import type { AtRiskView, ComponentsView } from "../../data/schemas";
import { countText, REPOSITORIES } from "../../layout/navCounts";
import { renderRoute, withMaintainerViews } from "../../test/renderRoute";
import { shownAtRiskCount } from "../AtRisk/atRiskDefaults";
import { TRIAGE_ITEMS, triageLabel } from "./TriageCards";

vi.mock("../../components/PlotFigure", () => ({
  PlotFigure: ({ ariaLabel }: { ariaLabel: string }) => <div role="img" aria-label={ariaLabel} />,
}));

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
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
    records: [atRiskRow("openedx/a", true), atRiskRow("openedx/b", false), atRiskRow("openedx/c", true), atRiskRow("openedx/d", false)],
    ...overrides,
  };
}

function componentsView(overrides: Partial<ComponentsView> = {}): ComponentsView {
  return {
    metadata: metadata("components"),
    available: true,
    summary: { repos: 183, with_file: 171, with_problem: 42 },
    findings: [],
    components: [],
    relations: [],
    ...overrides,
  };
}

function attentionRecord(repo_name: string) {
  return { repo_name, repo_tier: "critical", score_composite: 10, score_letter: "F", reasons: "grade F" };
}

beforeEach(() => {
  views.current = {
    overview: ready(overviewFixture()),
    attention: ready({ metadata: metadata("attention"), records: ["a", "b", "c"].map((name) => attentionRecord(`openedx/${name}`)) }),
    at_risk: ready(atRiskView()),
    upgrades: ready({
      metadata: metadata("upgrades"),
      upgrade_jobs: { collected_at: null, states: { failing: 45, healthy: 30 }, records: [] },
      waves: [],
      redundant_prs: null,
    }),
    components: ready(componentsView()),
  };
});

function triage() {
  return screen.findByRole("region", { name: "Triage" });
}

describe("triage cards", () => {
  it("links each card to its page with a count-bearing name and a description", async () => {
    renderRoute("/", withMaintainerViews(true));
    const cards = within(await triage()).getAllByRole("link");

    expect(cards.map((card) => [card.getAttribute("aria-label"), card.getAttribute("href")])).toEqual([
      ["Needing attention: 3 repositories", "/needing_attention"],
      ["At risk: 2 repositories", "/at_risk"],
      ["Upgrade jobs failing: 45 failing upgrade jobs", "/maintenance"],
      ["Catalog problems: 42 repositories", "/components"],
    ]);
    expect(cards[0]).toHaveAccessibleDescription(TRIAGE_ITEMS.attention.description);
    expect(within(cards[2] as HTMLElement).getByText("45")).toHaveClass("triage-card__count");
  });

  it("counts the same At Risk rows the At Risk page shows by default", async () => {
    const view = atRiskView();
    const expected = shownAtRiskCount(view);
    const overview = renderRoute("/", withMaintainerViews(true));
    const card = within(await triage()).getByRole("link", { name: /^At risk/ });
    expect(card).toHaveAccessibleName(triageLabel(TRIAGE_ITEMS.atRisk, expected ?? -1));
    overview.unmount();

    renderRoute("/at_risk", withMaintainerViews(true));
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row").length - 1).toBe(expected);
    expect(countText(expected ?? -1, REPOSITORIES)).toBe("2 repositories");
  });

  it("omits At Risk when maintainer views are off or there is no owner data", async () => {
    const { unmount } = renderRoute("/", withMaintainerViews(false));
    expect(within(await triage()).queryByRole("link", { name: /^At risk/ })).not.toBeInTheDocument();
    unmount();

    views.current = { ...views.current, at_risk: ready(atRiskView({ has_owner_data: false })) };
    renderRoute("/", withMaintainerViews(true));
    const region = await triage();
    expect(within(region).queryByRole("link", { name: /^At risk/ })).not.toBeInTheDocument();
    expect(within(region).getAllByRole("link")).toHaveLength(3);
  });

  it("omits cards whose data is unavailable or still loading", async () => {
    views.current = {
      ...views.current,
      attention: { status: "loading", data: undefined, error: undefined },
      upgrades: ready({ metadata: metadata("upgrades"), upgrade_jobs: null, waves: [], redundant_prs: null }),
      components: ready(componentsView({ available: false })),
    };
    renderRoute("/", withMaintainerViews(true));
    const links = within(await triage()).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/at_risk"]);
  });

  it("keeps a zero count visible as good news", async () => {
    views.current = { ...views.current, components: ready(componentsView({ summary: { repos: 3, with_file: 3, with_problem: 0 } })) };
    renderRoute("/", withMaintainerViews(true));
    expect(within(await triage()).getByRole("link", { name: "Catalog problems: 0 repositories" })).toBeInTheDocument();
  });
});

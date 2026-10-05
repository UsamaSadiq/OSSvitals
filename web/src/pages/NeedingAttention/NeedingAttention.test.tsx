import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type { AttentionView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { renderRoute } from "../../test/renderRoute";
import { attentionCsv, rowsForTier, type AttentionRow } from "./attentionRows";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready<Name extends ViewName>(data: unknown): ViewState<Name> {
  return { status: "ready", data, error: undefined } as ViewState<Name>;
}

const RECORDS: AttentionRow[] = [
  { repo_name: "openedx/edx-platform", repo_tier: "critical", score_composite: 35.5, score_letter: "D", reasons: "Score below 40" },
  { repo_name: "openedx/frontend-app", repo_tier: "important", score_composite: 52, score_letter: "C", reasons: "No release in 180 days; stale PRs" },
  { repo_name: "openedx/xblock-x", repo_tier: "standard", score_composite: 18.25, score_letter: "F", reasons: 'Says "archived", maybe' },
];

function attentionFixture(records: AttentionRow[] = RECORDS): AttentionView {
  return { metadata: metadata("attention_rules.yaml"), records };
}

function setAttention(records?: AttentionRow[]) {
  views.current = { attention: ready(attentionFixture(records)) };
}

function tableRepoNames(): (string | null)[] {
  const table = screen.getByRole("table", { name: "Repos needing attention" });
  return within(table)
    .getAllByRole("link")
    .map((link) => link.textContent);
}

beforeEach(() => setAttention());

describe("Needing Attention page", () => {
  it("renders every flagged repo in JSON order with links, tier, score, grade and reasons", async () => {
    renderRoute("/needing_attention");

    expect(await screen.findByRole("heading", { level: 1, name: "Repos Needing Attention" })).toBeInTheDocument();
    expect(document.title).toBe("Needing Attention · Open edX Repo Health");
    expect(screen.getByLabelText("Tier filter")).toHaveValue("all");

    expect(tableRepoNames()).toEqual(["openedx/edx-platform", "openedx/frontend-app", "openedx/xblock-x"]);
    const table = screen.getByRole("table", { name: "Repos needing attention" });
    expect(within(table).getByRole("link", { name: "openedx/edx-platform" })).toHaveAttribute(
      "href",
      "/repo_detail?repo=openedx%2Fedx-platform",
    );
    const [, firstRow] = within(table).getAllByRole("row") as [HTMLElement, HTMLElement];
    expect(within(firstRow).getByText("critical")).toBeInTheDocument();
    expect(within(firstRow).getByText("35.5")).toBeInTheDocument();
    expect(within(firstRow).getByRole("img", { name: "Grade D" })).toBeInTheDocument();
    expect(within(firstRow).getByText("Score below 40")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Copy link to this view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Attention List" })).toBeInTheDocument();
  });

  it("filters rows by tier from the query string", async () => {
    renderRoute("/needing_attention?tier=critical");

    await screen.findByRole("table", { name: "Repos needing attention" });
    expect(screen.getByLabelText("Tier filter")).toHaveValue("critical");
    expect(tableRepoNames()).toEqual(["openedx/edx-platform"]);
  });

  it("falls back to all tiers for an unknown tier value", async () => {
    renderRoute("/needing_attention?tier=bogus");

    await screen.findByRole("table", { name: "Repos needing attention" });
    expect(tableRepoNames()).toHaveLength(3);
  });

  it("shows the empty state when no repo in the tier is flagged", async () => {
    setAttention(RECORDS.filter((row) => row.repo_tier !== "standard"));
    renderRoute("/needing_attention?tier=standard");

    const status = await screen.findByText("No repositories currently match the attention rules.");
    const banner = status.closest(".empty-state");
    expect(banner).toHaveClass("empty-state--good");
    expect(banner).toHaveTextContent("Nothing is flagged by the rules in attention_rules.yaml for this tier.");
    expect(within(banner as HTMLElement).getByText("attention_rules.yaml").tagName).toBe("CODE");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download Attention List" })).not.toBeInTheDocument();
  });

  it("names the file when the attention data fails to load", async () => {
    views.current = {
      attention: { status: "error", data: undefined, error: new Error("attention.json: schema_version 2, expected 1") },
    };
    renderRoute("/needing_attention");

    expect(await screen.findByRole("alert")).toHaveTextContent("attention.json: schema_version 2, expected 1");
  });
});

describe("attentionCsv", () => {
  it("serialises the shown rows with the Streamlit headers and quoting", () => {
    expect(attentionCsv(RECORDS)).toBe(
      [
        "repo_name,repo_tier,score_composite,score_letter,reasons",
        "openedx/edx-platform,critical,35.5,D,Score below 40",
        "openedx/frontend-app,important,52,C,No release in 180 days; stale PRs",
        'openedx/xblock-x,standard,18.25,F,"Says ""archived"", maybe"',
        "",
      ].join("\n"),
    );
  });

  it("serialises only the rows of the selected tier", () => {
    expect(attentionCsv(rowsForTier(RECORDS, "important"))).toBe(
      "repo_name,repo_tier,score_composite,score_letter,reasons\nopenedx/frontend-app,important,52,C,No release in 180 days; stale PRs\n",
    );
  });
});

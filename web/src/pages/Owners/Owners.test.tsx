import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type { OwnersView, ReposView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { DEFAULT_SITE_META, type SiteMeta } from "../../layout/siteMeta";
import { renderRoute } from "../../test/renderRoute";
import { gradeMixCaption, normalizeHandle, pythonFloat, reposForHandle } from "./ownerText";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready<Name extends ViewName>(data: unknown): ViewState<Name> {
  return { status: "ready", data, error: undefined } as ViewState<Name>;
}

type OwnerRecord = OwnersView["records"][number];
type RepoRecord = ReposView["records"][number];

function ownerRecord(owner: string, overrides: Partial<OwnerRecord> = {}): OwnerRecord {
  return {
    owner,
    owner_type: "team",
    owner_key: owner.toLowerCase(),
    repo_count: 2,
    avg_score: 61.25,
    d_or_f: 1,
    at_risk: 0,
    ...overrides,
  };
}

function ownersFixture(overrides: Partial<OwnersView> = {}): OwnersView {
  return {
    metadata: metadata("catalog-info.yaml owners"),
    coverage: 92.9,
    has_owner_data: true,
    groups: { theme: null, squad: null },
    records: [
      ownerRecord("Axim-Engineering", { repo_count: 2, avg_score: 61.25, at_risk: 1 }),
      ownerRecord("solo-dev", { owner_type: "single person", repo_count: 1, avg_score: 80, d_or_f: 0 }),
    ],
    grade_mix: {
      "axim-engineering": { A: 0, B: 1, C: 0, D: 1, F: 0 },
      "solo-dev": { A: 1, B: 0, C: 0, D: 0, F: 0 },
    },
    repos: {
      "axim-engineering": [
        {
          repo_name: "openedx/weak",
          score_composite: 35,
          score_letter: "D",
          score_activity: 30.77,
          lifecycle: "production",
          release: null,
          catalog_link: "https://backstage.openedx.org/catalog/default/component/weak",
        },
        {
          repo_name: "openedx/strong",
          score_composite: 75.5,
          score_letter: "B",
          score_activity: null,
          lifecycle: "experimental",
          release: "teak",
          catalog_link: "https://backstage.openedx.org/catalog/default/component/strong",
        },
      ],
      "solo-dev": [],
    },
    ...overrides,
  };
}

function repo(repo_name: string, score_composite: number, owner_handles: string[]): RepoRecord {
  return { repo_name, score_composite, score_letter: "C", checks: {}, category_stats: {}, owner_handles };
}

function reposFixture(): ReposView {
  return {
    metadata: metadata("scored snapshot"),
    records: [
      repo("openedx/b-repo", 50, ["alice", "openedx"]),
      repo("openedx/low", 20, ["alice"]),
      repo("openedx/a-repo", 50, ["alice"]),
      repo("openedx/other", 90, ["bob", "alice-smith"]),
    ],
  };
}

function setViews(owners: OwnersView = ownersFixture()) {
  views.current = { owners: ready(owners), repos: ready(reposFixture()) };
}

function withMyRepos(enabled: boolean): SiteMeta {
  return { ...DEFAULT_SITE_META, featureFlags: { ...DEFAULT_SITE_META.featureFlags, enableMyReposFilter: enabled } };
}

function tabNames(): (string | null)[] {
  return screen.getAllByRole("tab").map((tab) => tab.textContent);
}

function linkTexts(table: HTMLElement): (string | null)[] {
  return within(table)
    .getAllByRole("link")
    .filter((link) => link.textContent !== "Catalog")
    .map((link) => link.textContent);
}

async function openMyRepos(meta?: SiteMeta) {
  renderRoute("/ownership_views", meta);
  await userEvent.click(await screen.findByRole("tab", { name: "My Repos" }));
}

beforeEach(() => setViews());

describe("Owners page", () => {
  it("shows the coverage tile and caption without a warning when coverage is high", async () => {
    renderRoute("/ownership_views");

    const tile = await screen.findByRole("group", { name: "Ownership Coverage" });
    expect(tile).toHaveTextContent("92.9%");
    expect(screen.getByText("spec.owner", { selector: "code" }).closest("p")).toHaveTextContent(
      "Ownership is sourced primarily from each repo's catalog-info.yaml (spec.owner, per OEP-55). Theme/Squad come from the working-group spreadsheet and are only present for orgs that maintain it.",
    );
    expect(screen.queryByText(/Ownership data is not yet populated/)).not.toBeInTheDocument();
    expect(document.title).toBe("Owners · Open edX Repo Health");
    expect(screen.getByRole("button", { name: "Copy link to this view" })).toBeInTheDocument();
  });

  it("warns when coverage is below 20 percent", async () => {
    setViews(ownersFixture({ coverage: 0 }));
    renderRoute("/ownership_views");

    expect(await screen.findByRole("group", { name: "Ownership Coverage" })).toHaveTextContent("0.0%");
    const warning = screen.getByText(/Ownership data is not yet populated/).closest(".banner");
    expect(warning).toHaveClass("banner--warn");
    expect(warning).toHaveTextContent(
      "Ownership data is not yet populated for most repositories, so these views are mostly empty. To appear here, a repository needs spec.owner set in its catalog-info.yaml (OEP-55).",
    );
  });

  it("lists owners in the given order with links that select an owner", async () => {
    renderRoute("/ownership_views");

    expect(await screen.findByText("Select a row to explore that owner's repositories.")).toBeInTheDocument();
    expect(screen.getByText("Select an owner's row to see its repositories.")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Owners" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent?.replace(/[↕▲▼]/g, ""))).toEqual([
      "Owner",
      "Type",
      "Repositories",
      "Average score",
      "Grade D or F",
      "At risk",
    ]);
    expect(linkTexts(table)).toEqual(["Axim-Engineering", "solo-dev"]);
    expect(within(table).getByRole("link", { name: "solo-dev" })).toHaveAttribute("href", "/ownership_views?owner=solo-dev");
    expect(within(table).getByText("61.3")).toBeInTheDocument();

    await userEvent.click(within(table).getByRole("link", { name: "solo-dev" }));
    expect(await screen.findByRole("heading", { level: 2, name: "solo-dev" })).toBeInTheDocument();
  });

  it("shows the owner panel for ?owner=, normalising the key", async () => {
    renderRoute("/ownership_views?owner=%20AXIM-engineering%20");

    const panel = (await screen.findByRole("heading", { level: 2, name: "Axim-Engineering" })).closest("section") as HTMLElement;
    expect(within(panel).getByText("Team · 2 repositories")).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: "Repositories" })).toHaveTextContent("2");
    expect(within(panel).getByRole("group", { name: "Average score" })).toHaveTextContent("61.2");
    expect(within(panel).getByRole("group", { name: "Grade D or F" })).toHaveTextContent("1");
    expect(within(panel).getByRole("group", { name: "At risk" })).toHaveTextContent("1");
    expect(within(panel).getByText("Grades: A 0 · B 1 · C 0 · D 1 · F 0")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "See the at-risk repositories" })).toHaveAttribute("href", "/at_risk");

    const repos = within(panel).getByRole("table", { name: "Repositories owned by Axim-Engineering" });
    expect(linkTexts(repos)).toEqual(["openedx/weak", "openedx/strong"]);
    expect(within(repos).getByRole("link", { name: "openedx/weak" })).toHaveAttribute(
      "href",
      "/repo_detail?repo=openedx%2Fweak",
    );
    expect(within(repos).getAllByRole("link", { name: "Catalog" })[0]).toHaveAttribute(
      "href",
      "https://backstage.openedx.org/catalog/default/component/weak",
    );
    expect(within(repos).getByText("30.8")).toBeInTheDocument();
    expect(within(repos).getByText("teak")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Copy link to this owner" })).toBeInTheDocument();
  });

  it("omits the at-risk link when the owner has none", async () => {
    renderRoute("/ownership_views?owner=solo-dev");

    expect(await screen.findByText("Single person · 1 repositories")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See the at-risk repositories" })).not.toBeInTheDocument();
  });

  it("explains an unknown owner", async () => {
    renderRoute("/ownership_views?owner=Gone-Team");

    const state = await screen.findByText("No owner named “gone-team” in this snapshot.");
    expect(state.closest(".empty-state")).toHaveTextContent("It may have been renamed or removed.");
  });

  it("closes the owner panel", async () => {
    renderRoute("/ownership_views?owner=solo-dev");

    await userEvent.click(await screen.findByRole("button", { name: "Close owner details" }));
    expect(screen.queryByRole("heading", { level: 2, name: "solo-dev" })).not.toBeInTheDocument();
    expect(screen.getByText("Select an owner's row to see its repositories.")).toBeInTheDocument();
  });

  it("explains missing owner data", async () => {
    setViews(ownersFixture({ has_owner_data: false, records: [] }));
    renderRoute("/ownership_views");

    const state = await screen.findByText("No owner data in this snapshot.");
    expect(state.closest(".empty-state")).toHaveTextContent(
      "A repository appears here once its catalog-info.yaml sets spec.owner (OEP-55). None currently do.",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("hides the theme and squad tabs when the groups are null", async () => {
    renderRoute("/ownership_views");

    await screen.findByRole("tab", { name: "By Owner" });
    expect(tabNames()).toEqual(["By Owner", "My Repos"]);
  });

  it("shows theme and squad tabs when the groups carry data", async () => {
    setViews(
      ownersFixture({
        groups: {
          theme: [{ "ownership.theme": "Learning", repo_count: 3, avg_score: 55.55, d_or_f: 1 }],
          squad: [],
        },
      }),
    );
    renderRoute("/ownership_views");

    await screen.findByRole("tab", { name: "By Owner" });
    expect(tabNames()).toEqual(["By Owner", "By Theme", "By Squad", "My Repos"]);

    await userEvent.click(screen.getByRole("tab", { name: "By Theme" }));
    const table = screen.getByRole("table", { name: "Repositories by theme" });
    expect(within(table).getAllByRole("columnheader")[0]).toHaveTextContent("Theme");
    expect(within(table).getByText("Learning")).toBeInTheDocument();
    expect(within(table).getByText("55.5")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "By Squad" }));
    expect(screen.getByText("No squads found.")).toBeInTheDocument();
  });

  it("matches repositories by exact handle, best score first", async () => {
    await openMyRepos();

    expect(
      screen.getByText(
        "Matches GitHub handle against repo owner from repo_name and ownership/maintainer fields when available.",
      ),
    ).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "GitHub handle" });
    expect(input).toHaveAttribute("placeholder", "e.g. openedx");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await userEvent.type(input, "@Alice ");
    const table = screen.getByRole("table", { name: "Repositories matching the handle" });
    expect(linkTexts(table)).toEqual(["openedx/a-repo", "openedx/b-repo", "openedx/low"]);
  });

  it("explains a handle with no matches", async () => {
    await openMyRepos();

    await userEvent.type(screen.getByRole("textbox", { name: "GitHub handle" }), "nobody");
    const state = screen.getByText("No repositories matched that handle.");
    expect(state.closest(".empty-state")).toHaveTextContent(
      "Ownership fields are largely unpopulated, so most repositories cannot be matched to anyone yet.",
    );
  });

  it("shows the switched-off state when the my repos filter is disabled", async () => {
    await openMyRepos(withMyRepos(false));

    const state = screen.getByText("This view is switched off for this deployment.");
    expect(state.closest(".empty-state")).toHaveTextContent(
      "Enable enable_my_repos_filter in dashboard/config/feature_flags.yaml.",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("owner text helpers", () => {
  it("normalises a handle like Python _normalize_handle", () => {
    expect(normalizeHandle("@Alice ")).toBe("alice");
    expect(normalizeHandle("  @@Bob")).toBe("bob");
    expect(normalizeHandle("@")).toBe("");
  });

  it("matches nothing for an empty handle", () => {
    expect(reposForHandle(reposFixture().records, "")).toEqual([]);
  });

  it("renders floats like Python", () => {
    expect(pythonFloat(0)).toBe("0.0");
    expect(pythonFloat(100)).toBe("100.0");
    expect(pythonFloat(33.33)).toBe("33.33");
  });

  it("lists the grade mix in grade order", () => {
    expect(gradeMixCaption({ F: 1, D: 0, C: 2, B: 0, A: 3 })).toBe("Grades: A 3 · B 0 · C 2 · D 0 · F 1");
  });
});

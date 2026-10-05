import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type { ComponentsView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { renderRoute } from "../../test/renderRoute";
import { collectedLabel, filterOptions, type ComponentRow } from "./componentRows";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready<Name extends ViewName>(data: unknown): ViewState<Name> {
  return { status: "ready", data, error: undefined } as ViewState<Name>;
}

function component(repo: string, overrides: Partial<ComponentRow> = {}): ComponentRow {
  return {
    repo_name: `openedx/${repo}`,
    has_file: true,
    type: "library",
    lifecycle: "production",
    owner: "group:axim-engineering",
    release: null,
    score_letter: "B",
    score_composite: 65,
    finding_count: 0,
    backstage_url: `https://backstage.openedx.org/catalog/default/component/${repo}`,
    ...overrides,
  };
}

const COMPONENTS: ComponentRow[] = [
  component("edx-platform", { type: "service", release: "main", score_letter: "C", finding_count: 2 }),
  component("frontend-app-learning", { type: "website", lifecycle: "experimental" }),
  component("xblock-lti", { release: "", owner: "user:someone" }),
  component("no-catalog", { has_file: false, type: null, lifecycle: null, owner: null, score_letter: "A" }),
];

function snapshot(overrides: Partial<ComponentsView> = {}): ComponentsView {
  return {
    metadata: metadata("catalog-info.yaml snapshot"),
    available: true,
    collected_at: "2026-10-03T10:33:51.114491+00:00",
    summary: { repos: 4, with_file: 3, with_problem: 1 },
    findings: [
      {
        code: "no_catalog_info",
        label: "No catalog-info.yaml",
        severity: "problem",
        repos: [{ repo_name: "openedx/no-catalog", score_letter: "A", owner: null }],
      },
      {
        code: "description_missing",
        label: "No description",
        severity: "note",
        repos: [
          { repo_name: "openedx/edx-platform", score_letter: "C", owner: "group:axim-engineering" },
          { repo_name: "openedx/xblock-lti", score_letter: "B", owner: "user:someone" },
        ],
      },
    ],
    components: COMPONENTS,
    relations: [
      { repo_name: "openedx/xblock-lti", relation: "dependsOn", target: "edx-platform", status: "known" },
    ],
    ...overrides,
  };
}

function setComponents(view: ComponentsView) {
  views.current = { components: ready(view) };
}

function componentNames(): (string | null)[] {
  const table = screen.getByRole("table", { name: "Declared components" });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("link")[0]!.textContent);
}

beforeEach(() => setComponents(snapshot()));

describe("Components page", () => {
  it("shows the info empty state when no catalog snapshot exists", async () => {
    setComponents({ metadata: metadata("catalog-info.yaml snapshot"), available: false });
    renderRoute("/components");

    const title = await screen.findByText("No catalog snapshot yet.");
    const banner = title.closest(".empty-state");
    expect(banner).toHaveClass("empty-state--info");
    expect(banner).toHaveTextContent(
      "It is published daily by the collect-maintenance workflow; check back after its next run.",
    );
    expect(screen.getByRole("link", { name: "Backstage" })).toHaveAttribute(
      "href",
      "https://backstage.openedx.org/catalog",
    );
    expect(screen.queryByRole("heading", { name: "Catalog issues" })).not.toBeInTheDocument();
  });

  it("renders the intro, collection caption and summary tiles", async () => {
    renderRoute("/components");

    expect(await screen.findByRole("heading", { level: 1, name: "Components" })).toBeInTheDocument();
    expect(document.title).toBe("Components · Open edX Repo Health");
    expect(screen.getAllByText("catalog-info.yaml")[0]!.tagName).toBe("CODE");
    expect(
      screen.getByText(
        "Collected 2026-10-03 10:33 UTC from each repo's default branch. User owners are checked against GitHub; group owners are not, since that needs openedx org membership.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Repositories" })).toHaveTextContent("4");
    const withFile = screen.getByRole("group", { name: "With catalog-info.yaml" });
    expect(withFile).toHaveTextContent("3");
    expect(withFile).toHaveTextContent("1 have none.");
    expect(screen.getByRole("group", { name: "With a problem to fix" })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Copy link to this view" })).toBeInTheDocument();
  });

  it("lists each finding as a card that expands to its repositories", async () => {
    renderRoute("/components");

    await screen.findByRole("heading", { name: "Catalog issues" });
    expect(
      screen.getByText("Problems stop Backstage or this dashboard from reading the entry correctly; notes are worth a look."),
    ).toBeInTheDocument();
    const cards = [...document.querySelectorAll<HTMLElement>(".finding-card")];
    expect(cards.map((card) => card.querySelector("summary")?.textContent)).toEqual([
      "Problem1 repoNo catalog-info.yamlRepositories",
      "Note2 reposNo descriptionRepositories",
    ]);
    expect(cards[0]).toHaveClass("finding-card--problem");
    expect(cards[1]).toHaveClass("finding-card--note");
    expect(cards[1]?.querySelector("details")).not.toHaveAttribute("open");

    await userEvent.click(within(cards[1] as HTMLElement).getByText("No description"));
    expect(cards[1]?.querySelector("details")).toHaveAttribute("open");

    const noteTable = screen.getByRole("table", { name: "Repositories with No description" });
    expect(within(noteTable).getByRole("link", { name: "openedx/xblock-lti" })).toHaveAttribute(
      "href",
      "/repo_detail?repo=openedx%2Fxblock-lti",
    );
    expect(within(noteTable).getByRole("img", { name: "Grade C" })).toBeInTheDocument();
    expect(within(noteTable).getByText("user:someone")).toBeInTheDocument();
  });

  it("shows the good empty state when there are no findings", async () => {
    setComponents(snapshot({ findings: [] }));
    renderRoute("/components");

    const title = await screen.findByText("Every repository's catalog entry is complete.");
    expect(title.closest(".empty-state")).toHaveClass("empty-state--good");
  });

  it("lists only declared components with their columns", async () => {
    renderRoute("/components");

    await screen.findByRole("table", { name: "Declared components" });
    expect(screen.getByText("3 of 3 declared components.")).toBeInTheDocument();
    expect(componentNames()).toEqual(["openedx/edx-platform", "openedx/frontend-app-learning", "openedx/xblock-lti"]);
    const table = screen.getByRole("table", { name: "Declared components" });
    const [, first, , third] = within(table).getAllByRole("row") as HTMLElement[];
    expect(within(first!).getByText("main")).toBeInTheDocument();
    expect(within(first!).getByText("2")).toBeInTheDocument();
    expect(within(first!).getByRole("link", { name: "Backstage" })).toHaveAttribute(
      "href",
      "https://backstage.openedx.org/catalog/default/component/edx-platform",
    );
    expect(within(third!).getByText("no")).toBeInTheDocument();
  });

  it("filters by type and lifecycle from the URL", async () => {
    renderRoute("/components?type=library&lifecycle=production");

    await screen.findByRole("table", { name: "Declared components" });
    expect(screen.getByLabelText("Type")).toHaveValue("library");
    expect(screen.getByLabelText("Lifecycle")).toHaveValue("production");
    expect([...(screen.getByLabelText("Type") as HTMLSelectElement).options].map((option) => option.value)).toEqual([
      "All",
      "library",
      "service",
      "website",
    ]);
    expect(componentNames()).toEqual(["openedx/xblock-lti"]);
    expect(screen.getByText("1 of 3 declared components.")).toBeInTheDocument();
  });

  it("shows the empty message when the filters match nothing", async () => {
    renderRoute("/components?type=website&lifecycle=production");

    expect(await screen.findByText("No components match these filters.")).toBeInTheDocument();
    expect(screen.getByText("0 of 3 declared components.")).toBeInTheDocument();
  });

  it("filters by release membership", async () => {
    renderRoute("/components?release=In+a+named+release");

    await screen.findByRole("table", { name: "Declared components" });
    expect(componentNames()).toEqual(["openedx/edx-platform"]);

    await userEvent.selectOptions(screen.getByLabelText("Release"), "Not in a release");
    expect(componentNames()).toEqual(["openedx/frontend-app-learning", "openedx/xblock-lti"]);
  });

  it("groups declared relations by repository with a count summary", async () => {
    setComponents(
      snapshot({
        relations: [
          { repo_name: "openedx/xblock-lti", relation: "Depends on", target: "edx-platform", status: "In catalog" },
          { repo_name: "openedx/aspects", relation: "Part of", target: "tutor", status: "Not in catalog" },
          { repo_name: "openedx/xblock-lti", relation: "Part of", target: "xblock", status: "Not in catalog" },
        ],
      }),
    );
    renderRoute("/components");

    await screen.findByRole("heading", { name: "Declared relations" });
    expect(screen.getByText("subcomponentOf").tagName).toBe("CODE");
    expect(screen.getByText("3 relations across 2 repositories: 1 in catalog · 2 not in catalog")).toBeInTheDocument();
    const groups = [...document.querySelectorAll<HTMLElement>(".relation-group")];
    expect(groups.map((group) => group.querySelector("summary")?.textContent)).toEqual([
      "openedx/aspects1 relation · 1 not in catalog",
      "openedx/xblock-lti2 relations · 1 in catalog · 1 not in catalog",
    ]);

    await userEvent.click(within(groups[1] as HTMLElement).getByText("xblock-lti"));
    const table = screen.getByRole("table", { name: "Relations declared by openedx/xblock-lti" });
    expect(within(table).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([
      "Depends onedx-platformIn catalog",
      "Part ofxblockNot in catalog",
    ]);
  });

  it("hides the relations section when nothing is declared", async () => {
    setComponents(snapshot({ relations: [] }));
    renderRoute("/components");

    await screen.findByRole("table", { name: "Declared components" });
    expect(screen.queryByRole("heading", { name: "Declared relations" })).not.toBeInTheDocument();
  });
});

describe("componentRows", () => {
  it("formats the collection time like Streamlit", () => {
    expect(collectedLabel("2026-10-03T10:33:51.114491+00:00")).toBe("2026-10-03 10:33 UTC");
  });

  it("builds sorted distinct options without empty values", () => {
    expect(filterOptions(["b", null, "a", "", "b", undefined])).toEqual(["All", "a", "b"]);
  });
});

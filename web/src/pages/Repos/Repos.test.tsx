import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type { FailingChecksView, ReposView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { renderRoute } from "../../test/renderRoute";
import { WATCHLIST_KEY, watchlistStore } from "../../watchlist/watchlist";
import { CSV_COLUMNS, readSort, sortedRepos } from "./repoColumns";
import { filterRows, gradesParam, parseGrades, readFilters, type RepoRow } from "./repoFilters";
import { toCsv } from "../../format/csv";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready<Name extends ViewName>(data: unknown): ViewState<Name> {
  return { status: "ready", data, error: undefined } as ViewState<Name>;
}

function repo(name: string, letter: RepoRow["score_letter"], composite: number, overrides: Partial<RepoRow> = {}): RepoRow {
  return {
    repo_name: `openedx/${name}`,
    score_composite: composite,
    score_letter: letter,
    checks: { "dependabot.exists": "pass", "readme.exists": "pass" },
    category_stats: {},
    owner_handles: [],
    repo_tier: "standard",
    score_structural: 70,
    score_activity: 50,
    "github.last_push": "2026-09-30 10:00:00",
    "ownership.owner_name": null,
    ...overrides,
  };
}

const RECORDS: RepoRow[] = [
  repo("edx-platform", "B", 72.5, { repo_tier: "important", "ownership.owner_name": "axim", "ownership.lifecycle": "production" }),
  repo("frontend-app-learning", "A", 88, { "ownership.owner_name": "2u", "ownership.lifecycle": "production" }),
  repo("xblock-lti", "C", 45, { checks: { "dependabot.exists": "fail", "readme.exists": "pass" } }),
  repo("old-thing", "F", 12, {
    checks: { "dependabot.exists": "fail", "readme.exists": "fail" },
    "ownership.lifecycle": "deprecated",
    "github.last_push": null,
  }),
  repo("platform-plugin", "D", 30, { score_activity: null }),
];

function failingFixture(): FailingChecksView {
  return {
    metadata: metadata("failing"),
    records: [
      { check: "dependabot.exists", failing: 2 },
      { check: "readme.exists", failing: 1 },
    ],
  };
}

function setRepos(records: RepoRow[] = RECORDS) {
  const reposView: ReposView = { metadata: metadata("repos"), records };
  views.current = { repos: ready(reposView), failing_checks: ready(failingFixture()) };
}

function table() {
  return screen.getByRole("table", { name: "Repositories" });
}

function shownRepos(): string[] {
  return within(table())
    .getAllByRole("link")
    .map((link) => link.textContent ?? "");
}

beforeEach(() => {
  setRepos();
  window.localStorage.clear();
  watchlistStore.reload();
});

afterEach(() => vi.restoreAllMocks());

describe("Repositories explorer", () => {
  it("lists every repository by composite score with a count line", async () => {
    renderRoute("/repos");
    expect(await screen.findByRole("heading", { level: 1, name: "Repositories" })).toBeInTheDocument();
    expect(document.title).toMatch(/^Repositories/);
    expect(screen.getByText("5 of 5 repositories")).toBeInTheDocument();
    expect(shownRepos()).toEqual([
      "openedx/frontend-app-learning",
      "openedx/edx-platform",
      "openedx/xblock-lti",
      "openedx/platform-plugin",
      "openedx/old-thing",
    ]);
    const firstRow = within(table()).getAllByRole("row")[1] as HTMLElement;
    expect(within(firstRow).getByRole("img", { name: "Grade A" })).toBeInTheDocument();
    expect(firstRow).toHaveTextContent("88.0");
    expect(firstRow).toHaveTextContent("2026-09-30");
  });

  it("filters by grade from the URL and toggles grade chips into the URL", async () => {
    const { router } = renderRoute("/repos?grade=A");
    await screen.findByText("1 of 5 repositories");
    expect(screen.getByRole("button", { name: "Grade A" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Grade F" }));

    expect(router.state.location.search).toBe("?grade=A%2CF");
    expect(shownRepos()).toEqual(["openedx/frontend-app-learning", "openedx/old-thing"]);

    await userEvent.click(screen.getByRole("button", { name: "Grade A" }));
    await userEvent.click(screen.getByRole("button", { name: "Grade F" }));
    expect(router.state.location.search).toBe("");
  });

  it("filters by tier, owner and lifecycle with values present in the data", async () => {
    const { router } = renderRoute("/repos?tier=important");
    await screen.findByText("1 of 5 repositories");

    const owner = screen.getByRole("combobox", { name: "Owner" });
    expect(within(owner).getAllByRole("option").map((option) => option.textContent)).toEqual(["Any owner", "2u", "axim"]);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Tier" }), "Any tier");
    await userEvent.selectOptions(owner, "2u");
    expect(router.state.location.search).toBe("?owner=2u");
    expect(shownRepos()).toEqual(["openedx/frontend-app-learning"]);

    await userEvent.selectOptions(owner, "Any owner");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Lifecycle" }), "deprecated");
    expect(shownRepos()).toEqual(["openedx/old-thing"]);
  });

  it("hides facets with no values and ignores unknown facet values in the URL", async () => {
    setRepos(RECORDS.map((record) => ({ ...record, "ownership.owner_name": null, "ownership.lifecycle": undefined })));
    renderRoute("/repos?owner=nobody&tier=bogus");
    await screen.findByText("5 of 5 repositories");
    expect(screen.queryByRole("combobox", { name: "Owner" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Lifecycle" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tier" })).toHaveValue("");
  });

  it("filters to repositories failing a check, picked by typing its name", async () => {
    const { router } = renderRoute("/repos");
    const picker = await screen.findByRole("combobox", { name: "Fails check" });

    await userEvent.type(picker, "dependabot.exists");

    expect(router.state.location.search).toBe("?fails=dependabot.exists");
    expect(shownRepos()).toEqual(["openedx/xblock-lti", "openedx/old-thing"]);
  });

  it("reads ?fails= from the URL", async () => {
    renderRoute("/repos?fails=readme.exists");
    expect(await screen.findByText("1 of 5 repositories")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Fails check" })).toHaveValue("readme.exists");
  });

  it("searches with the shared match ranking and keeps the match order", async () => {
    const { router } = renderRoute("/repos");
    await userEvent.type(await screen.findByRole("searchbox", { name: "Search repositories" }), "platform");

    expect(router.state.location.search).toBe("?q=platform");
    expect(shownRepos()).toEqual(["openedx/platform-plugin", "openedx/edx-platform"]);
    expect(screen.getByText("2 of 5 repositories")).toBeInTheDocument();
  });

  it("shows only watched repositories with watched=1", async () => {
    window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(["openedx/xblock-lti"]));
    watchlistStore.reload();
    renderRoute("/repos?watched=1");
    await screen.findByText("1 of 5 repositories");
    expect(screen.getByRole("button", { name: "Watched only" })).toHaveAttribute("aria-pressed", "true");
    expect(within(table()).getByRole("button", { name: "Watch openedx/xblock-lti" })).toHaveAttribute("aria-pressed", "true");
  });

  it("watches a repository from its row", async () => {
    renderRoute("/repos");
    await userEvent.click(await screen.findByRole("button", { name: "Watch openedx/edx-platform" }));
    expect(window.localStorage.getItem(WATCHLIST_KEY)).toBe('["openedx/edx-platform"]');
  });

  it("shows an empty state that clears every filter", async () => {
    const { router } = renderRoute("/repos?grade=A&tier=important&sort=repo&dir=asc");
    expect(await screen.findByText("No repositories match these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(router.state.location.search).toBe("?sort=repo&dir=asc");
    expect(screen.getByText("5 of 5 repositories")).toBeInTheDocument();
  });

  it("sorts every filtered row through the URL", async () => {
    const { router } = renderRoute("/repos");
    await screen.findByText("5 of 5 repositories");

    await userEvent.click(within(table()).getByRole("button", { name: /Repository/ }));

    expect(router.state.location.search).toBe("?sort=repo&dir=asc");
    expect(shownRepos()[0]).toBe("openedx/edx-platform");
    expect(within(table()).getByRole("columnheader", { name: /Repository/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("pages 50 rows at a time and keeps the page in the URL", async () => {
    const many = Array.from({ length: 120 }, (_, index) => repo(`repo-${String(index).padStart(3, "0")}`, "B", 60));
    setRepos(many);
    const { router } = renderRoute("/repos?sort=repo&dir=asc");
    await screen.findByText("120 of 120 repositories");
    expect(within(table()).getAllByRole("link")).toHaveLength(50);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(router.state.location.search).toBe("?sort=repo&dir=asc&page=2");
    expect(shownRepos()[0]).toBe("openedx/repo-050");

    await userEvent.click(screen.getByRole("button", { name: "Grade B" }));
    expect(router.state.location.search).toBe("?sort=repo&dir=asc&grade=B");
  });

  it("clamps an out-of-range page", async () => {
    renderRoute("/repos?page=9");
    await screen.findByText("5 of 5 repositories");
    expect(within(table()).getAllByRole("link")).toHaveLength(5);
  });

  it("downloads the filtered rows, not only the current page, as CSV", async () => {
    const blobs: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return "blob:test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderRoute("/repos?grade=C,F");

    await userEvent.click(await screen.findByRole("button", { name: "Download CSV" }));

    const text = await blobs[0]?.text();
    expect(text).toBe(
      "repo_name,score_letter,score_composite,score_structural,score_activity,repo_tier,github.last_push\n" +
        "openedx/xblock-lti,C,45,70,50,standard,2026-09-30 10:00:00\n" +
        "openedx/old-thing,F,12,70,50,standard,\n",
    );
  });

  it("reports a load failure", async () => {
    views.current = { repos: { status: "error", data: undefined, error: new Error("repos.json: HTTP 500") } };
    renderRoute("/repos");
    expect(await screen.findByRole("alert")).toHaveTextContent("repos.json: HTTP 500");
  });

  it("is in the nav after Overview", async () => {
    renderRoute("/repos");
    const nav = await screen.findByRole("navigation", { name: "Pages" });
    const names = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(names.slice(0, 2)).toEqual(["Overview", "Repositories"]);
  });
});

describe("explorer helpers", () => {
  it("round-trips grades through the URL in A to F order", () => {
    expect(parseGrades("f,a,x")).toEqual(["A", "F"]);
    expect(gradesParam(["F", "A"])).toBe("A,F");
    expect(gradesParam([])).toBeNull();
  });

  it("filters, sorts and exports without the page", () => {
    const params = new URLSearchParams("grade=A,B,C&sort=activity&dir=asc");
    const filters = readFilters(params, { tier: [], owner: [], lifecycle: [], fails: [] });
    const rows = sortedRepos(filterRows(RECORDS, filters, []), readSort(params, false));
    expect(rows.map((row) => row.repo_name)).toEqual([
      "openedx/edx-platform",
      "openedx/frontend-app-learning",
      "openedx/xblock-lti",
    ]);
    expect(toCsv(CSV_COLUMNS, rows).split("\n")).toHaveLength(5);
  });

  it("defaults to composite descending and drops the default sort while searching", () => {
    expect(readSort(new URLSearchParams(), false)).toEqual({ key: "composite", direction: "descending" });
    expect(readSort(new URLSearchParams("q=x"), true)).toBeUndefined();
    expect(readSort(new URLSearchParams("sort=nope"), false)).toEqual({ key: "composite", direction: "descending" });
  });
});

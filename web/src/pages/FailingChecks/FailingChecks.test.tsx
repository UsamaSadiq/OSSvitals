import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type { FailingChecksView, ReposView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { renderRoute } from "../../test/renderRoute";
import type { FailingCheckRow, RepoRow } from "./failingRows";

vi.mock("../../components/PlotFigure", () => ({
  PlotFigure: ({ ariaLabel }: { ariaLabel: string }) => <div role="img" aria-label={ariaLabel} data-testid="plot" />,
}));

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready<Name extends ViewName>(data: unknown): ViewState<Name> {
  return { status: "ready", data, error: undefined } as ViewState<Name>;
}

function repo(repo_name: string, score_composite: number, score_letter: RepoRow["score_letter"], checks: RepoRow["checks"]): RepoRow {
  return { repo_name, score_composite, score_letter, checks, category_stats: {}, owner_handles: [] };
}

const REPOS: RepoRow[] = [
  repo("openedx/zeta", 70, "B", { has_readme: "fail", has_codeowners: "pass" }),
  repo("openedx/alpha", 70, "B", { has_readme: "fail", has_codeowners: "fail" }),
  repo("openedx/low", 18.5, "F", { has_readme: "pass", has_codeowners: "unknown" }),
  repo("openedx/high", 93.3, "A", { has_readme: "pass", has_codeowners: "pass" }),
];

const CHECKS: FailingCheckRow[] = [
  { check: "has_readme", failing: 2 },
  { check: "has_codeowners", failing: 1 },
];

function manyChecks(count: number): FailingCheckRow[] {
  return Array.from({ length: count }, (_, index) => ({ check: `check_${index}`, failing: count - index }));
}

function setViews(checks: FailingCheckRow[] = CHECKS) {
  const failing: FailingChecksView = { metadata: metadata("failing_checks"), records: checks };
  const repos: ReposView = { metadata: metadata("repos"), records: REPOS };
  views.current = { failing_checks: ready(failing), repos: ready(repos) };
}

function tableRepoNames(): (string | null)[] {
  const table = screen.getByRole("table", { name: "Repositories by failing check" });
  return within(table)
    .getAllByRole("link")
    .map((link) => link.textContent);
}

beforeEach(() => setViews());

describe("Failing Checks page", () => {
  it("shows the good empty state when no check fails", async () => {
    setViews([]);
    renderRoute("/failing_checks");

    const status = await screen.findByText("No failing checks detected.");
    expect(status.closest(".empty-state")).toHaveClass("empty-state--good");
    expect(screen.getByText("Every collected check passes across the whole organisation.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Most-failed checks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders the chart and every repo by ascending score with a name tiebreak", async () => {
    renderRoute("/failing_checks");

    expect(await screen.findByRole("heading", { level: 1, name: "Failing Checks" })).toBeInTheDocument();
    expect(document.title).toBe("Failing Checks · Open edX Repo Health");
    expect(screen.getByRole("heading", { level: 2, name: "Most-failed checks" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Repositories failing each check: has_readme 2, has_codeowners 1" })).toBeInTheDocument();
    expect(screen.queryByText(/most-failed of/)).not.toBeInTheDocument();

    expect(screen.getByLabelText("Inspect a check")).toHaveValue("All repositories");
    expect(within(screen.getByLabelText("Inspect a check")).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "All repositories",
      "has_readme",
      "has_codeowners",
    ]);
    expect(tableRepoNames()).toEqual(["openedx/low", "openedx/alpha", "openedx/zeta", "openedx/high"]);
    expect(screen.queryByText(/repositories fail/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link to this view" })).toBeInTheDocument();
  });

  it("caps the chart at 15 checks and says so", async () => {
    setViews(manyChecks(20));
    renderRoute("/failing_checks");

    const chart = await screen.findByRole("img", { name: /^Repositories failing each check/ });
    expect(chart.getAttribute("aria-label")).toContain("check_14 6");
    expect(chart.getAttribute("aria-label")).not.toContain("check_15");
    expect(
      screen.getByText("Showing the 15 most-failed of 20 failing checks. Use the selector below to inspect any of them."),
    ).toBeInTheDocument();
    expect(within(screen.getByLabelText("Inspect a check")).getAllByRole("option")).toHaveLength(21);
  });

  it("filters the table to repos failing the check in ?category=", async () => {
    renderRoute("/failing_checks?category=has_readme");

    await screen.findByRole("table", { name: "Repositories by failing check" });
    expect(screen.getByLabelText("Inspect a check")).toHaveValue("has_readme");
    const caption = screen.getByText(/repositories fail/);
    expect(caption).toHaveTextContent("2 repositories fail has_readme.");
    expect(within(caption).getByText("has_readme").tagName).toBe("CODE");
    expect(tableRepoNames()).toEqual(["openedx/alpha", "openedx/zeta"]);
  });

  it("filters when a check is chosen in the selector", async () => {
    renderRoute("/failing_checks");

    await userEvent.selectOptions(await screen.findByLabelText("Inspect a check"), "has_codeowners");

    expect(screen.getByText(/repositories fail/)).toHaveTextContent("1 repositories fail has_codeowners.");
    expect(tableRepoNames()).toEqual(["openedx/alpha"]);
  });

  it("shows the empty message when no repo record fails the selected check", async () => {
    setViews([...CHECKS, { check: "has_license", failing: 1 }]);
    renderRoute("/failing_checks?category=has_license");

    expect(await screen.findByText("No repositories fail the selected check.")).toBeInTheDocument();
    expect(screen.getByText(/^0 repositories fail/)).toHaveTextContent("0 repositories fail has_license.");
  });

  it("falls back to all repositories for an unknown category", async () => {
    renderRoute("/failing_checks?category=bogus");

    await screen.findByRole("table", { name: "Repositories by failing check" });
    expect(screen.getByLabelText("Inspect a check")).toHaveValue("All repositories");
    expect(tableRepoNames()).toHaveLength(4);
    expect(screen.queryByText(/repositories fail/)).not.toBeInTheDocument();
  });

  it("names the file when the failing checks fail to load", async () => {
    views.current = {
      failing_checks: { status: "error", data: undefined, error: new Error("failing_checks.json: schema_version 2, expected 1") },
      repos: views.current.repos,
    };
    renderRoute("/failing_checks");

    expect(await screen.findByRole("alert")).toHaveTextContent("failing_checks.json: schema_version 2, expected 1");
  });
});

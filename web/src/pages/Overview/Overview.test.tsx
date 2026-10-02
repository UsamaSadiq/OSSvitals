import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata, overviewFixture } from "../../data/fixtures";
import type { HistoryView, OverviewView, ReposView, ScoringView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { renderRoute } from "../../test/renderRoute";

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

function historyFixture(): HistoryView {
  return {
    metadata: metadata("history"),
    dates: ["2026-08-01", "2026-09-25", "2026-10-02"],
    org_average: [
      ["2026-08-01", 60],
      ["2026-09-25", 70.35],
      ["2026-10-02", 70.04],
    ],
    repos: {},
  };
}

function reposFixture(): ReposView {
  const record = (repo_name: string, score_composite: number, score_letter: "A" | "B" | "C") => ({
    repo_name,
    score_composite,
    score_letter,
    checks: {},
  });
  return {
    metadata: metadata("repos"),
    records: [record("openedx/y", 46.7, "C"), record("openedx/b", 70, "B"), record("openedx/a", 70, "B"), record("openedx/x", 93.3, "A")],
  };
}

function scoringFixture(): ScoringView {
  return {
    metadata: metadata("scoring"),
    version: null,
    metrics: [],
    letter_bands: [
      { grade: "A", from: 85, to: 100 },
      { grade: "B", from: 60, to: 84 },
      { grade: "C", from: 40, to: 59 },
      { grade: "D", from: 20, to: 39 },
      { grade: "F", from: 0, to: 19 },
    ],
    proposed: null,
  };
}

function setViews(overview: OverviewView = overviewFixture()) {
  views.current = {
    overview: ready(overview),
    history: ready(historyFixture()),
    repos: ready(reposFixture()),
  };
}

beforeEach(() => setViews());

describe("Overview page", () => {
  it("renders the header, KPI hero and activity line", async () => {
    renderRoute("/");

    expect(await screen.findByRole("heading", { level: 1, name: "Open edX Repository Health Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Visualization-first health insights for Open edX repositories")).toBeInTheDocument();
    expect(document.title).toBe("Overview · Open edX Repo Health");

    expect(screen.getByRole("img", { name: /Org average score 70\.0 out of 100, grade B, based on 92% of metric weight/ })).toBeInTheDocument();
    expect(screen.getByText("3 repositories · snapshot 2026-10-02 (UTC)")).toBeInTheDocument();

    const gradeA = screen.getByRole("group", { name: "Grade A" });
    expect(within(gradeA).getByText("1")).toBeInTheDocument();
    expect(within(gradeA).getByText("+1")).toHaveClass("kpi-tile__delta--good");
    expect(within(screen.getByRole("group", { name: "Grade F" })).getByText("no change")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Score measured" })).getByText("92%")).toBeInTheDocument();
    expect(screen.getByText(/Columns present in the snapshot: 100%\./)).toBeInTheDocument();

    expect(screen.getByRole("img", { name: /Org-average composite over 2 snapshots/ })).toBeInTheDocument();
    expect(screen.getByText("Org-average composite · last 2 snapshots")).toBeInTheDocument();
    expect(screen.getByText("Across 3 repositories: 3,007 open issues · 1,552 open PRs")).toBeInTheDocument();
    expect(screen.queryByText("Scores are directional.")).not.toBeInTheDocument();
  });

  it("renders the grade mix ribbon and the chart tabs", async () => {
    renderRoute("/");

    expect(await screen.findByRole("heading", { level: 2, name: "Grade mix" })).toBeInTheDocument();
    const ribbon = screen.getByRole("img", { name: /Grade A: 1 repos \(33\.3%\)/ });
    expect(ribbon.firstElementChild).toHaveTextContent("A · 1");

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Grade distribution", "Per-category pass rate", "Top failing checks"]);
    expect(screen.getByText("2/3 repos (67%) at grade B or better")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Repositories per grade: A 1, B 1, C 1, D 0, F 0" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Per-category pass rate" }));
    expect(screen.getByText("avg 47% pass · 1 categories")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Top failing checks" }));
    expect(screen.getByText("3 failures across 1 checks")).toBeInTheDocument();
    expect(within(screen.getByRole("tabpanel")).getByRole("link", { name: "Failing Checks" })).toHaveAttribute(
      "href",
      "/failing_checks",
    );
  });

  it("moves between tabs with the arrow keys", async () => {
    renderRoute("/");
    const first = await screen.findByRole("tab", { name: "Grade distribution" });
    first.focus();

    await userEvent.keyboard("{ArrowRight}");
    const second = screen.getByRole("tab", { name: "Per-category pass rate" });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Top failing checks" })).toHaveFocus();
  });

  it("renders highlights, movers and the full table", async () => {
    renderRoute("/");

    expect(await screen.findByRole("heading", { level: 2, name: "Highlights" })).toBeInTheDocument();
    const top = screen.getByRole("list", { name: "Top 5" });
    expect(within(top).getByRole("link", { name: "openedx/x" })).toHaveAttribute("href", "/repo_detail?repo=openedx%2Fx");
    expect(within(top).getByText("93.3")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Bottom 5" })).getByText("openedx/y")).toBeInTheDocument();

    const gainers = screen.getByRole("table", { name: "Biggest gainers" });
    expect(within(gainers).getByText("+10.0")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Biggest losers" })).getByText("-10.0")).toBeInTheDocument();
    expect(screen.getByText("Composite score change · 2026-09-23 → 2026-10-02 (UTC)")).toBeInTheDocument();

    expect(screen.getByText("Full table — 3 repos", { selector: "summary" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Full table — 3 repos" });
    const names = within(table)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(names).toEqual(["openedx/x", "openedx/a", "openedx/b", "openedx/y"]);
  });

  it("re-sorts the full table when a column header is clicked", async () => {
    renderRoute("/");
    const table = await screen.findByRole("table", { name: "Full table — 3 repos" });

    await userEvent.click(within(table).getByRole("button", { name: /Repository/ }));

    const names = within(table)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(names).toEqual(["openedx/a", "openedx/b", "openedx/x", "openedx/y"]);
    expect(within(table).getByRole("columnheader", { name: /Repository/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("warns that scores are directional when little weight is measured", async () => {
    const base = overviewFixture();
    setViews(
      overviewFixture({
        kpis: { ...base.kpis, avg_measured_weight: 0.5 },
        unavailable_metrics: ["release_cadence", "time_to_merge"],
      }),
    );
    renderRoute("/");

    const warning = await screen.findByText("Scores are directional.");
    expect(warning.parentElement).toHaveTextContent(
      "Only 50% of the scoring weight can be computed from this snapshot; the rest falls back to a fixed default of 50, which moves no repository up or down relative to any other. Not collected: release_cadence, time_to_merge.",
    );
  });

  it("hides deltas without a baseline and the movers section without movers", async () => {
    setViews(overviewFixture({ kpi_deltas: null, movers: [], gainers: [], losers: [], activity_totals: {} }));
    renderRoute("/");

    await screen.findByRole("heading", { level: 2, name: "Highlights" });
    expect(screen.queryByText("no change")).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Biggest gainers" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Composite score change/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Across /)).not.toBeInTheDocument();
  });

  it("shows the empty messages for movers in one direction only", async () => {
    setViews(overviewFixture({ losers: [] }));
    renderRoute("/");

    expect(await screen.findByText("No repositories declined over this window.")).toBeInTheDocument();
  });

  it("shows the empty states for empty chart inputs", async () => {
    setViews(overviewFixture({ category_pass_rates: [], top_failing: [] }));
    renderRoute("/");

    await userEvent.click(await screen.findByRole("tab", { name: "Per-category pass rate" }));
    expect(screen.getByText("No categorisable check columns in this snapshot.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Top failing checks" }));
    expect(screen.getByText("No failing checks in the current filter scope.")).toBeInTheDocument();
  });

  it("names the file when the overview data fails to load", async () => {
    views.current = {
      overview: { status: "error", data: undefined, error: new Error("overview.json: schema_version 2, expected 1") },
    };
    renderRoute("/");

    expect(await screen.findByRole("alert")).toHaveTextContent("overview.json: schema_version 2, expected 1");
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("draws the gauge bands from scoring.json letter bands", async () => {
    views.current = { ...views.current, scoring: ready(scoringFixture()) };
    renderRoute("/");

    const gauge = await screen.findByRole("img", { name: /Org average score/ });
    expect(within(gauge).getByText("85")).toBeInTheDocument();
    expect(within(gauge).queryByText("80")).not.toBeInTheDocument();
  });
});

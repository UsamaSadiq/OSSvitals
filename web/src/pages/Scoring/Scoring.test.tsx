import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type { ScoringView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { renderRoute } from "../../test/renderRoute";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready<Name extends ViewName>(data: unknown): ViewState<Name> {
  return { status: "ready", data, error: undefined } as ViewState<Name>;
}

type MetricRow = ScoringView["metrics"][number];
type Proposed = NonNullable<ScoringView["proposed"]>;

function metricRow(overrides: Partial<MetricRow> = {}): MetricRow {
  return {
    metric: "commit recency",
    category: "activity",
    weight_pct: 15,
    source: "github.last_push",
    rule: "≤ 7 days → 100; older → 0",
    missing_scores_as: 50,
    measured_pct: 63.3,
    defaulted_pct: 36.7,
    chaoss_metric: "Code Changes",
    provisional: false,
    limitation: "",
    ...overrides,
  };
}

const EMPTY_MIGRATION_ROW = { A: 0, B: 0, C: 0, D: 0, F: 0 };

function proposedFixture(overrides: Partial<Proposed> = {}): Proposed {
  return {
    version: "3.0-proposed",
    swaps: [
      {
        metric: "catalog info valid",
        replaces: "openedx.yaml present (exists.openedx.yaml)",
        source: "ownership.owner",
        rule: "share of required fields that are set (`ownership.owner`, `ownership.lifecycle`), × 100",
        in_snapshot: true,
        measured_pct: 92.9,
      },
    ],
    migration: {
      A: { ...EMPTY_MIGRATION_ROW, A: 39, B: 18 },
      B: { ...EMPTY_MIGRATION_ROW, A: 15, B: 48, C: 7 },
      C: EMPTY_MIGRATION_ROW,
      D: { ...EMPTY_MIGRATION_ROW, C: 1 },
      F: EMPTY_MIGRATION_ROW,
    },
    changes: [
      {
        repo_name: "openedx/modular-learning",
        current: "D",
        proposed: "C",
        current_score: 23.67,
        proposed_score: 46.17,
        change: 22.5,
      },
      {
        repo_name: "openedx/edx-cookiecutters",
        current: "B",
        proposed: "C",
        current_score: 66.83,
        proposed_score: 45.83,
        change: -21,
      },
    ],
    ...overrides,
  };
}

function scoringFixture(overrides: Partial<ScoringView> = {}): ScoringView {
  return {
    metadata: metadata("scoring.yaml and scoring_proposed.yaml"),
    version: "2.0",
    metrics: [
      metricRow({ provisional: true, limitation: "Blank when the repo opened no PRs in 90 days." }),
      metricRow({
        metric: "ci status",
        category: "structural",
        weight_pct: 10,
        source: "github_actions",
        rule: "100 if the check passes, 0 if it fails",
        missing_scores_as: 0,
        measured_pct: null,
        defaulted_pct: null,
        chaoss_metric: "",
      }),
    ],
    letter_bands: [
      { grade: "A", from: 80, to: 100 },
      { grade: "B", from: 60, to: 79 },
      { grade: "F", from: 0, to: 19 },
    ],
    proposed: proposedFixture(),
    ...overrides,
  };
}

function setScoring(scoring: ScoringView = scoringFixture()) {
  views.current = { scoring: ready(scoring) };
}

function headingNames() {
  const page = screen.getByRole("region", { name: "How Scoring Works" });
  return within(page)
    .getAllByRole("heading")
    .map((heading) => heading.textContent);
}

beforeEach(() => setScoring());

describe("How Scoring Works page", () => {
  it("renders every section in Streamlit's order", async () => {
    renderRoute("/scoring");

    await screen.findByRole("heading", { level: 2, name: "Grade bands" });
    expect(document.title).toMatch(/^How Scoring Works/);
    expect(headingNames()).toEqual([
      "How Scoring Works",
      "Grade bands",
      "Metrics",
      "How each metric is scored",
      "Missing data",
      "Known limitations",
      "Proposed changes",
      "How grades would move",
      "Independence",
    ]);
    expect(screen.getByRole("button", { name: "Copy link to this view" })).toBeInTheDocument();
  });

  it("renders the intro with the version and source links", async () => {
    renderRoute("/scoring");

    expect(await screen.findByText(/\(version 2\.0\), not hardcoded\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "edx-repo-health" })).toHaveAttribute(
      "href",
      "https://github.com/openedx/edx-repo-health",
    );
    expect(screen.getByRole("link", { name: "openedx/wg-maintenance" })).toHaveAttribute(
      "href",
      "https://github.com/openedx/wg-maintenance/tree/main/dashboards",
    );
    expect(screen.getByRole("link", { name: "scores.json" })).toHaveAttribute(
      "href",
      "https://github.com/UsamaSadiq/OSSvitals/blob/data/openedx/scores.json",
    );
  });

  it("renders the grade bands, metrics table, rules and missing-data defaults", async () => {
    renderRoute("/scoring");

    const bands = (await screen.findByRole("heading", { name: "Grade bands" })).nextElementSibling;
    expect(bands).toHaveTextContent("A 80–100 · B 60–79 · F 0–19");

    const table = screen.getByRole("table", { name: "Metrics" });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent?.replace(/[▲▼↕]/g, ""));
    expect(headers).toEqual(["Metric", "Category", "Weight", "Measured", "Defaulted", "CHAOSS metric"]);
    const firstRow = within(table).getAllByRole("row")[1]!;
    expect(within(firstRow).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "commit recency",
      "activity",
      "15%",
      "63%",
      "37%",
      "Code Changes",
    ]);
    expect(screen.getByText(/^Measured: share of repos with a usable value today\./)).toBeInTheDocument();

    const rule = screen.getByText("ci status", { selector: "li > strong" }).parentElement;
    expect(rule).toHaveTextContent("ci status (github_actions): 100 if the check passes, 0 if it fails");

    expect(screen.getByText("0, 50", { selector: "strong" })).toBeInTheDocument();
  });

  it("lists limitations and provisional thresholds", async () => {
    renderRoute("/scoring");

    const heading = await screen.findByRole("heading", { name: "Known limitations" });
    const list = heading.nextElementSibling as HTMLElement;
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "commit recency: Blank when the repo opened no PRs in 90 days.",
      "Provisional thresholds (commit recency): set from current data and awaiting review by the Open edX Maintenance Working Group.",
    ]);
  });

  it("hides known limitations when there are none", async () => {
    setScoring(scoringFixture({ metrics: [metricRow()] }));
    renderRoute("/scoring");

    await screen.findByRole("heading", { name: "Missing data" });
    expect(screen.queryByRole("heading", { name: "Known limitations" })).not.toBeInTheDocument();
  });

  it("renders the proposed swaps, migration grid and grade changes", async () => {
    renderRoute("/scoring");

    expect(await screen.findByText(/^Scoring version 3\.0-proposed replaces metrics/)).toBeInTheDocument();
    const swaps = screen.getByRole("table", { name: "Proposed metric swaps" });
    expect(within(swaps).getByText("ownership.lifecycle", { selector: "code" })).toBeInTheDocument();
    expect(within(swaps).getByText("93%")).toBeInTheDocument();
    expect(screen.queryByText(/Not in this snapshot yet/)).not.toBeInTheDocument();

    const grid = screen.getByRole("table", { name: "How grades would move" });
    expect(within(grid).getByRole("columnheader", { name: "Current grade" })).toBeInTheDocument();
    expect(within(grid).getByRole("columnheader", { name: "Proposed grade" })).toBeInTheDocument();
    const rowA = within(grid).getByRole("rowheader", { name: "A" }).parentElement as HTMLElement;
    expect(within(rowA).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["39", "18", "0", "0", "0"]);
    expect(screen.getByText(/^Rows are today's grades, columns the proposed ones/)).toBeInTheDocument();

    expect(screen.getByText("2 repositories would change letter grade:")).toBeInTheDocument();
    const changes = screen.getByRole("table", { name: "Repositories that would change letter grade" });
    expect(within(changes).getByRole("link", { name: "openedx/modular-learning" })).toHaveAttribute(
      "href",
      "/repo_detail?repo=openedx%2Fmodular-learning",
    );
    expect(within(changes).getByText("+22.5")).toBeInTheDocument();
    expect(within(changes).getByText("-21.0")).toBeInTheDocument();
  });

  it("names swaps whose inputs are not in the snapshot yet", async () => {
    const pending = { ...proposedFixture().swaps[0]!, in_snapshot: false, measured_pct: null };
    setScoring(scoringFixture({ proposed: proposedFixture({ swaps: [pending] }) }));
    renderRoute("/scoring");

    const banner = (await screen.findByText(/^Not in this snapshot yet:/)).closest(".banner") as HTMLElement;
    expect(banner).toHaveTextContent("Not in this snapshot yet: catalog info valid (ownership.owner).");
    expect(within(banner).getByText("ownership.owner", { selector: "code" })).toBeInTheDocument();
    expect(banner).toHaveTextContent(/The upstream checks that report these are pending/);
  });

  it("says no repository changes grade when the change list is empty", async () => {
    setScoring(scoringFixture({ proposed: proposedFixture({ changes: [] }) }));
    renderRoute("/scoring");

    expect(
      await screen.findByText("No repository changes letter grade under the proposed method."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/repositories would change letter grade/)).not.toBeInTheDocument();
  });

  it("hides the proposed section when there is no proposed method", async () => {
    setScoring(scoringFixture({ proposed: null }));
    renderRoute("/scoring");

    await screen.findByRole("heading", { name: "Independence" });
    expect(screen.queryByRole("heading", { name: "Proposed changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "How grades would move" })).not.toBeInTheDocument();
  });

  it("renders the independence statement with the issue link", async () => {
    renderRoute("/scoring");

    expect(await screen.findByText(/^Every check, weight, threshold and score for public repositories/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "open an issue" })).toHaveAttribute(
      "href",
      "https://github.com/UsamaSadiq/OSSvitals/issues",
    );
  });

  it("shows the error state when no metrics are configured", async () => {
    setScoring(scoringFixture({ metrics: [] }));
    renderRoute("/scoring");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No scoring configuration found.");
    expect(alert).toHaveTextContent("Expected dashboard/config/openedx/scoring.yaml with a metrics section.");
    expect(screen.queryByRole("heading", { name: "Grade bands" })).not.toBeInTheDocument();
  });

  it("names the file when the scoring data fails to load", async () => {
    views.current = {
      scoring: { status: "error", data: undefined, error: new Error("scoring.json: schema_version 2, expected 1") },
    };
    renderRoute("/scoring");

    expect(await screen.findByRole("alert")).toHaveTextContent("scoring.json: schema_version 2, expected 1");
  });
});

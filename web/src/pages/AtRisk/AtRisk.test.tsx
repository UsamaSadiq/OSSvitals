import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type { AtRiskView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { renderRoute } from "../../test/renderRoute";
import { atRiskCsv, baselineCaption, formatSignedDelta } from "./atRiskText";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready<Name extends ViewName>(data: unknown): ViewState<Name> {
  return { status: "ready", data, error: undefined } as ViewState<Name>;
}

type Row = AtRiskView["records"][number];

function row(repo_name: string, overrides: Partial<Row> = {}): Row {
  return {
    repo_name,
    owner_status: "needs maintainer",
    owner: "openedx-unmaintained",
    lifecycle: "production",
    release: "",
    score_composite: 46.83,
    score_letter: "C",
    score_activity: 28.46,
    days_since_push: 125,
    delta: 3.5294117647,
    reasons: "activity score below 40",
    catalog_link: `https://backstage.openedx.org/catalog/default/component/${repo_name.split("/")[1]}`,
    production_or_release: true,
    ...overrides,
  };
}

function atRiskFixture(overrides: Partial<AtRiskView> = {}): AtRiskView {
  return {
    metadata: metadata("stewardship_risk rule"),
    enabled: true,
    has_owner_data: true,
    has_lifecycle_data: true,
    baseline_date: "2026-09-23",
    skipped_metrics: ["time_to_merge", "pr_response_time"],
    records: [
      row("openedx/prod"),
      row("openedx/experimental", { lifecycle: "experimental", production_or_release: false, delta: null, owner: null }),
    ],
    ...overrides,
  };
}

function setAtRisk(view: AtRiskView) {
  views.current = { at_risk: ready(view) };
}

function repoNames(): (string | null)[] {
  const table = screen.getByRole("table", { name: "Repositories at risk" });
  return within(table)
    .getAllByRole("link")
    .filter((link) => link.textContent !== "Catalog")
    .map((link) => link.textContent);
}

beforeEach(() => setAtRisk(atRiskFixture()));

describe("At Risk page", () => {
  it("stops at the no-owner state when the snapshot has no owner data", async () => {
    setAtRisk(atRiskFixture({ has_owner_data: false }));
    renderRoute("/at_risk");

    const state = await screen.findByText("No owner data in this snapshot.");
    expect(state.closest(".banner")).toHaveClass("banner--info");
    expect(within(state.closest(".banner") as HTMLElement).getByText("catalog-info.yaml", { selector: "code" })).toBeInTheDocument();
    expect(state.closest(".banner")).toHaveTextContent(
      "A repository is assessed here once its catalog-info.yaml sets spec.owner (OEP-55).",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy link to this view" })).not.toBeInTheDocument();
    expect(document.title).toBe("At Risk · Open edX Repo Health");
  });

  it("shows the switched-off state when the rule is disabled", async () => {
    setAtRisk(atRiskFixture({ enabled: false, records: [] }));
    renderRoute("/at_risk");

    const state = await screen.findByText("The at-risk view is switched off for this deployment.");
    expect(state.closest(".banner")).toHaveTextContent("Enable stewardship_risk in attention_rules.yaml.");
    expect(screen.getByText("stewardship_risk", { selector: "code" })).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link to this view" })).toBeInTheDocument();
  });

  it("explains the baseline and the metrics left out of the score change", async () => {
    renderRoute("/at_risk");

    expect(await screen.findByText(/^Repositories waiting for a maintainer \(/)).toHaveTextContent(
      "Repositories waiting for a maintainer (openedx-unmaintained), owned by a single person",
    );
    expect(screen.getByText("openedx-unmaintained", { selector: "code" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Score change is measured against the 2026-09-23 snapshot. Leaves out pr response time, time to merge, whose measurement changed since then, so a method change does not read as a decline.",
      ),
    ).toBeInTheDocument();
  });

  it("omits the like-for-like note without skipped metrics and the caption without a baseline", () => {
    expect(baselineCaption("2026-09-23", [])).toBe("Score change is measured against the 2026-09-23 snapshot.");
    setAtRisk(atRiskFixture({ baseline_date: null }));
    renderRoute("/at_risk");
    expect(screen.queryByText(/Score change is measured/)).not.toBeInTheDocument();
  });

  it("filters to production or release repos until the toggle is switched off", async () => {
    renderRoute("/at_risk");

    const toggle = await screen.findByRole("switch", { name: "Production or in a named release only" });
    expect(toggle).toBeChecked();
    expect(repoNames()).toEqual(["openedx/prod"]);

    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(repoNames()).toEqual(["openedx/prod", "openedx/experimental"]);
  });

  it("renders the Streamlit columns with formatted values and links", async () => {
    renderRoute("/at_risk");

    const table = await screen.findByRole("table", { name: "Repositories at risk" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent?.replace(/[▲▼↕]/g, ""))).toEqual([
      "Repository",
      "Ownership",
      "Owner",
      "Lifecycle",
      "Release",
      "Score",
      "Grade",
      "Activity",
      "Days since push",
      "Change",
      "Why flagged",
      "Backstage",
    ]);
    expect(within(table).getByRole("link", { name: "openedx/prod" })).toHaveAttribute("href", "/repo_detail?repo=openedx%2Fprod");
    expect(within(table).getByRole("link", { name: "Catalog" })).toHaveAttribute(
      "href",
      "https://backstage.openedx.org/catalog/default/component/prod",
    );
    expect(within(table).getByText("+3.5")).toBeInTheDocument();
    expect(within(table).getByText("46.8")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download At-Risk List" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link to this view" })).toBeInTheDocument();
  });

  it("shows the lifecycle caption instead of the toggle when lifecycle data is missing", async () => {
    setAtRisk(atRiskFixture({ has_lifecycle_data: false }));
    renderRoute("/at_risk");

    expect(await screen.findByText("Lifecycle and release data are not in this snapshot yet.")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(repoNames()).toEqual(["openedx/prod", "openedx/experimental"]);
  });

  it("shows the good empty state when nothing matches after filtering", async () => {
    setAtRisk(atRiskFixture({ records: [row("openedx/experimental", { production_or_release: false })] }));
    renderRoute("/at_risk");

    const state = await screen.findByText("No repositories match.");
    expect(state.closest(".banner")).toHaveClass("banner--good");
    expect(state.closest(".banner")).toHaveTextContent(
      "Nothing with thin ownership shows an activity warning under the stewardship_risk rule in attention_rules.yaml.",
    );
    expect(screen.queryByRole("button", { name: "Download At-Risk List" })).not.toBeInTheDocument();
  });

  it("names the file when the data fails to load", async () => {
    views.current = { at_risk: { status: "error", data: undefined, error: new Error("at_risk.json: bad") } };
    renderRoute("/at_risk");
    expect(await screen.findByRole("alert")).toHaveTextContent("at_risk.json: bad");
  });
});

describe("at-risk helpers", () => {
  it("formats the signed delta like %+.1f and leaves missing values empty", () => {
    expect(formatSignedDelta(3.5294117647)).toBe("+3.5");
    expect(formatSignedDelta(0)).toBe("+0.0");
    expect(formatSignedDelta(-2.25)).toBe("-2.2");
    expect(formatSignedDelta(null)).toBe("");
    expect(formatSignedDelta(undefined)).toBe("");
  });

  it("builds the CSV in Streamlit's column order", () => {
    const csv = atRiskCsv([
      row("openedx/prod", { owner: "alice, bob", reasons: 'no push in 125 days; "falling"' }),
      row("openedx/none", { owner: null, delta: null, score_activity: null }),
    ]);
    expect(csv).toBe(
      [
        "repo_name,owner_status,owner,lifecycle,release,score_composite,score_letter,score_activity,days_since_push,delta,reasons,catalog_link",
        'openedx/prod,needs maintainer,"alice, bob",production,,46.83,C,28.46,125,3.5294117647,"no push in 125 days; ""falling""",https://backstage.openedx.org/catalog/default/component/prod',
        "openedx/none,needs maintainer,,production,,46.83,C,,125,,activity score below 40,https://backstage.openedx.org/catalog/default/component/none",
        "",
      ].join("\n"),
    );
  });
});

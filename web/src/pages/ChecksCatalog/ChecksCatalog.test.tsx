import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type { ChecksView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { renderRoute } from "../../test/renderRoute";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready<Name extends ViewName>(data: unknown): ViewState<Name> {
  return { status: "ready", data, error: undefined } as ViewState<Name>;
}

type CheckRecord = ChecksView["records"][number];

function record(overrides: Partial<CheckRecord> & { check: string }): CheckRecord {
  return {
    title: overrides.check,
    category: null,
    description: null,
    populated_pct: 100,
    pass_pct: null,
    scored_by: null,
    has_remediation: false,
    remediation: null,
    pr_template: null,
    ...overrides,
  };
}

const RECORDS: CheckRecord[] = [
  record({
    check: "dependabot.exists",
    title: "Dependabot Config",
    category: "Dependencies",
    description: {
      description: "Keeps `requirements` fresh",
      chaoss_metric: "Maintained",
      scorecard_check: "Dependency-Update-Tool",
      source_url: "https://example.org/dependabot",
    },
    populated_pct: 100,
    pass_pct: 67.5,
    has_remediation: true,
  }),
  record({
    check: "exists.openedx.yaml",
    title: "openedx.yaml",
    category: "File Existence",
    description: { description: "Standard Open edX configuration file" },
    populated_pct: 98.8,
    pass_pct: 42.6,
    scored_by: { metric: "openedx_yaml_compliance", weight: 0.1, weight_pct: 10, status: "computable" },
    has_remediation: true,
  }),
  record({
    check: "ownership.owner",
    populated_pct: 55.1,
    scored_by: { metric: "ownership", weight: 0.05, weight_pct: 5, status: "unavailable" },
  }),
];

const UP_FOR_REVIEW = [
  { check: "dependabot.has_ecosystem.npm", kind: "saturated", dominant: "false", share_pct: 99.4, fill_pct: 100, outliers: 1 },
  { check: "exists.travis.yml", kind: "saturated", dominant: "false", share_pct: 98.75, fill_pct: 100, outliers: 2 },
  { check: "readme.badges", kind: "sparse", dominant: null, share_pct: null, fill_pct: 4.3, outliers: 0 },
];

const CANDIDATES = [
  {
    name: "SECURITY.md present",
    rationale: "A published security policy is a Scorecard signal.",
    status: "proposed",
    feasibility: "Local file check; zero API.",
    chaoss_metric: "Security",
    scorecard_check: "Security-Policy",
  },
  {
    name: "Branch protection",
    rationale: "Protects the default branch.",
    status: "phase-2",
    feasibility: "Needs admin scope.",
    scorecard_check: "Branch-Protection",
  },
  { name: "Retired idea", rationale: "Dropped.", status: "rejected" },
];

function checksFixture(overrides: Partial<ChecksView> = {}): ChecksView {
  return {
    metadata: metadata("check columns in the current snapshot"),
    records: RECORDS,
    review_window: { snapshots: 11, first: "2026-09-23", last: "2026-10-03" },
    up_for_review: UP_FOR_REVIEW,
    candidates: CANDIDATES,
    groups: [
      { name: "File Existence", checks: ["exists.openedx.yaml"] },
      { name: "Dependencies", checks: ["dependabot.exists"] },
      { name: "Ownership", checks: ["ownership.owner"] },
      { name: "Other checks", checks: ["dependabot.exists"] },
    ],
    saturation_share: 0.97,
    sparse_fill: 0.1,
    ...overrides,
  };
}

function setChecks(overrides: Partial<ChecksView> = {}) {
  views.current = { checks: ready(checksFixture(overrides)) };
}

function kpiValue(label: string): string | null {
  return within(screen.getByRole("group", { name: label })).getByText((_, element) =>
    Boolean(element?.classList.contains("kpi-tile__value")),
  ).textContent;
}

function entry(summaryText: string): HTMLElement {
  const summary = screen.getAllByText(summaryText, { selector: "summary strong" })[0] as HTMLElement;
  return summary.closest("details") as HTMLElement;
}

function headers(tableName: string): string[] {
  return within(screen.getByRole("table", { name: tableName }))
    .getAllByRole("columnheader")
    .map((cell) => cell.textContent?.replace(/[▲▼↕]/g, "") ?? "");
}

function rowCells(tableName: string, rowIndex: number): string[] {
  const rows = within(screen.getByRole("table", { name: tableName })).getAllByRole("row");
  return within(rows[rowIndex] as HTMLElement)
    .getAllByRole("cell")
    .map((cell) => cell.textContent ?? "");
}

beforeEach(() => setChecks());

describe("Checks Catalog page", () => {
  it("renders the title, intro and totals", async () => {
    renderRoute("/glossary");

    expect(await screen.findByRole("heading", { level: 1, name: "Checks Catalog" })).toBeInTheDocument();
    expect(document.title).toBe("Checks Catalog · Open edX Repo Health");
    expect(
      screen.getByText(
        "Every health check currently collected, what it measures, whether it feeds the composite score, and how the org is doing on it.",
      ),
    ).toBeInTheDocument();
    expect(kpiValue("Checks collected")).toBe("3");
    expect(kpiValue("Feeding the score")).toBe("2");
    expect(kpiValue("Missing descriptions")).toBe("1");
  });

  it("lists the groups in the order the data gives, a check in every group it belongs to", async () => {
    renderRoute("/glossary");

    await screen.findByRole("heading", { level: 2, name: "File Existence" });
    const page = screen.getByRole("region", { name: "Checks Catalog" });
    const groupHeadings = within(page)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
      .filter((name) => !["Up for review", "Suggested candidate checks"].includes(name ?? ""));
    expect(groupHeadings).toEqual(["File Existence", "Dependencies", "Ownership", "Other checks"]);
    expect(within(screen.getByRole("region", { name: "Ownership" })).getByText("ownership.owner")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Other checks" })).getByText("Dependabot Config")).toBeInTheDocument();
  });

  it("shows a check's title, raw column, description, score feed, sources and coverage", async () => {
    renderRoute("/glossary");

    await screen.findByRole("heading", { level: 2, name: "Dependencies" });
    const dependabot = entry("Dependabot Config");
    expect(within(dependabot).getByText("dependabot.exists").tagName).toBe("CODE");
    expect(within(dependabot).getByText("requirements").tagName).toBe("CODE");
    expect(dependabot).toHaveTextContent("Keeps requirements fresh");
    expect(dependabot).toHaveTextContent("Not part of the composite score (informational check).");
    expect(dependabot).toHaveTextContent("CHAOSS: Maintained · Scorecard: Dependency-Update-Tool · Source");
    expect(within(dependabot).getByRole("link", { name: "Source" })).toHaveAttribute("href", "https://example.org/dependabot");
    expect(within(within(dependabot).getByRole("group", { name: "Org coverage (populated)" })).getByText("100.0%")).toBeInTheDocument();
    expect(within(within(dependabot).getByRole("group", { name: "Pass rate" })).getByText("67.5%")).toBeInTheDocument();
    expect(dependabot).not.toHaveTextContent("Config gaps");

    const openedx = entry("openedx.yaml");
    expect(openedx).toHaveTextContent("Feeds score: openedx_yaml_compliance — weight 10.0% (✓ computable)");
    expect(within(openedx).getByText("openedx_yaml_compliance").tagName).toBe("CODE");
  });

  it("omits the raw column when the title is the column, and flags config gaps", async () => {
    renderRoute("/glossary");

    await screen.findByRole("heading", { level: 2, name: "Ownership" });
    const owner = entry("ownership.owner");
    expect(within(owner).queryByText("ownership.owner", { selector: "code" })).not.toBeInTheDocument();
    expect(within(owner).getByText("No description entry yet.").tagName).toBe("EM");
    expect(owner).toHaveTextContent("Feeds score: ownership — weight 5.0% (○ not yet collected)");
    expect(within(within(owner).getByRole("group", { name: "Pass rate" })).getByText("—")).toBeInTheDocument();
    expect(owner).toHaveTextContent("Config gaps: missing description, no remediation entry");
  });

  it("describes the review window across retained snapshots with the thresholds", async () => {
    renderRoute("/glossary");

    const section = await screen.findByRole("region", { name: "Up for review" });
    expect(section).toHaveTextContent(
      "Checks that no longer tell repositories apart, in all 11 retained snapshots, 2026-09-23 to 2026-10-03. Saturated: one value holds at least 97% of the repos that report it. Sparse: fewer than 10% of repos report it at all. These are raised with the Maintenance Working Group, which decides whether to retire a check, keep it to catch regressions, or fix its detection.",
    );
  });

  it("describes a single-snapshot review window", async () => {
    setChecks({ review_window: { snapshots: 1, first: "2026-10-03", last: "2026-10-03" } });
    renderRoute("/glossary");

    const section = await screen.findByRole("region", { name: "Up for review" });
    expect(section).toHaveTextContent(
      "Checks that no longer tell repositories apart, in the latest snapshot only (no history retained yet).",
    );
  });

  it("lists saturated and sparse checks with Streamlit's column labels", async () => {
    renderRoute("/glossary");

    expect(await screen.findByRole("heading", { level: 3, name: "Saturated (2)" })).toBeInTheDocument();
    expect(headers("Saturated checks")).toEqual(["Check", "Value almost every repo has", "Share", "Repos with another value"]);
    expect(rowCells("Saturated checks", 1)).toEqual(["dependabot.has_ecosystem.npm", "false", "99.4%", "1"]);
    expect(rowCells("Saturated checks", 2)).toEqual(["exists.travis.yml", "false", "98.8%", "2"]);

    expect(screen.getByRole("heading", { level: 3, name: "Sparse (1)" })).toBeInTheDocument();
    expect(headers("Sparse checks")).toEqual(["Check", "Repos reporting it"]);
    expect(rowCells("Sparse checks", 1)).toEqual(["readme.badges", "4.3%"]);
  });

  it("keeps the review prose and shows the good state when nothing is up for review", async () => {
    setChecks({ up_for_review: [] });
    renderRoute("/glossary");

    const section = await screen.findByRole("region", { name: "Up for review" });
    expect(section).toHaveTextContent("Checks that no longer tell repositories apart");
    const status = within(section).getByText("No check is saturated or sparse across the retained history.");
    expect(status.closest(".empty-state")).toHaveClass("empty-state--good");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("lists candidate checks by status", async () => {
    renderRoute("/glossary");

    const section = await screen.findByRole("region", { name: "Suggested candidate checks" });
    expect(section).toHaveTextContent(
      "Proposed additions to the health suite, informed by current community standards (CHAOSS, OpenSSF Scorecard). Not yet implemented.",
    );
    const subheadings = within(section)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(subheadings).toEqual(["Near-term (local-file checks, zero API)", "Phase 2 (need GitHub API / admin scope)"]);

    const security = entry("SECURITY.md present");
    expect(security).toHaveTextContent("A published security policy is a Scorecard signal.");
    expect(security).toHaveTextContent("How: Local file check; zero API.");
    expect(security).toHaveTextContent("CHAOSS: Security · Scorecard: Security-Policy");

    const protection = entry("Branch protection");
    expect(protection).toHaveTextContent("How: Needs admin scope.");
    expect(protection).not.toHaveTextContent("Scorecard");
    expect(within(section).queryByText("Retired idea")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link to this view" })).toBeInTheDocument();
  });

  it("hides the candidates section when there are none", async () => {
    setChecks({ candidates: [] });
    renderRoute("/glossary");

    await screen.findByRole("region", { name: "Up for review" });
    expect(screen.queryByRole("heading", { name: "Suggested candidate checks" })).not.toBeInTheDocument();
  });

  it("shows only the warning and candidates when the snapshot has no check columns", async () => {
    setChecks({ records: [] });
    renderRoute("/glossary");

    const status = await screen.findByText("No check columns detected in this snapshot.");
    const banner = status.closest(".empty-state");
    expect(banner).toHaveClass("empty-state--warn");
    expect(banner).toHaveTextContent("The catalogue below still lists proposed checks.");
    expect(screen.getByRole("heading", { level: 2, name: "Suggested candidate checks" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Up for review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Checks collected" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link to this view" })).toBeInTheDocument();
  });

  it("names the file when the checks data fails to load", async () => {
    views.current = { checks: { status: "error", data: undefined, error: new Error("checks.json: schema_version 2, expected 1") } };
    renderRoute("/glossary");

    expect(await screen.findByRole("alert")).toHaveTextContent("checks.json: schema_version 2, expected 1");
  });
});

function groupNames(): string[] {
  return within(screen.getByRole("region", { name: "Checks Catalog" }))
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent ?? "")
    .filter((name) => !["Up for review", "Suggested candidate checks"].includes(name));
}

describe("Checks Catalog search and filters", () => {
  it("shows the pass rate as a mini bar in each collapsed summary", async () => {
    renderRoute("/glossary");
    await screen.findByRole("heading", { level: 2, name: "Dependencies" });
    const summary = entry("openedx.yaml").querySelector("summary") as HTMLElement;
    expect(summary).toHaveTextContent("Pass rate 42.6%");
    expect(summary.querySelector(".mini-bar__fill--low")).toHaveStyle({ width: "42.6%" });
    expect(entry("ownership.owner").querySelector("summary")).toHaveTextContent("Pass rate —");
  });

  it("counts each chip and keeps the groups", async () => {
    renderRoute("/glossary");
    await screen.findByText("3 of 3 checks");
    expect(screen.getByRole("button", { name: "Feeds the score 2" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Pass rate under 50% 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Missing description 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Up for review 0" })).toBeInTheDocument();
  });

  it("filters by search text from the URL and by typing", async () => {
    const { router } = renderRoute("/glossary?q=dependabot");
    await screen.findByText("1 of 3 checks");
    expect(groupNames()).toEqual(["Dependencies", "Other checks"]);

    const search = screen.getByRole("searchbox", { name: "Search checks" });
    await userEvent.clear(search);
    await userEvent.type(search, "owner");
    expect(router.state.location.search).toBe("?q=owner");
    expect(groupNames()).toEqual(["Ownership"]);
  });

  it("combines chips through the URL", async () => {
    const { router } = renderRoute("/glossary?scored=1");
    await screen.findByText("2 of 3 checks");
    expect(groupNames()).toEqual(["File Existence", "Ownership"]);

    await userEvent.click(screen.getByRole("button", { name: /Pass rate under 50%/ }));

    expect(router.state.location.search).toBe("?scored=1&low_pass=1");
    expect(groupNames()).toEqual(["File Existence"]);
  });

  it("filters to checks with a missing description or up for review", async () => {
    setChecks({ up_for_review: [{ check: "dependabot.exists", kind: "saturated" }] });
    renderRoute("/glossary?review=1");
    await screen.findByText("1 of 3 checks");
    expect(groupNames()).toEqual(["Dependencies", "Other checks"]);

    await userEvent.click(screen.getByRole("button", { name: /Up for review/ }));
    await userEvent.click(screen.getByRole("button", { name: /Missing description/ }));
    expect(groupNames()).toEqual(["Ownership"]);
  });

  it("shows an empty state that clears every filter", async () => {
    const { router } = renderRoute("/glossary?q=zzz&scored=1");
    expect(await screen.findByText("No checks match these filters.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Up for review" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(router.state.location.search).toBe("");
    expect(screen.getByText("3 of 3 checks")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search checks" })).toHaveValue("");
  });
});


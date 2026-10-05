import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata, metaFixture, overviewFixture } from "../../data/fixtures";
import type { ChecksView, RepoDetailView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { DEFAULT_SITE_META, type SiteMeta } from "../../layout/siteMeta";
import { renderPlot } from "../../components/renderPlot";
import { renderRoute } from "../../test/renderRoute";
import { categorySparkline, ratePoints } from "./categorySparkline";
import { githubIssueUrl, githubPrCompareUrl } from "./checkLinks";
import { metricBarsChart, type MetricBar } from "./metricBarsChart";
import { rankRepos } from "./repoRanking";
import { firstVisible } from "./SectionNav";
import { formatSignal } from "./signalFormat";

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

const REPO = "openedx/alpha";
const PATH = `/repo_detail?repo=${encodeURIComponent(REPO)}`;

type RepoEntry = RepoDetailView["repos"][string];
type CheckRecord = ChecksView["records"][number];

const BARS: MetricBar[] = [
  { metric: "ci_status", state: "measured", score: 100, weight: 0.1, letter: "A" },
  { metric: "commit_recency", state: "measured", score: 42.5, weight: 0.15, letter: "C" },
  { metric: "pr_response_time", state: "defaulted", score: 50, weight: 0.15, letter: "C" },
  { metric: "release_frequency", state: "unavailable", score: 0, weight: null, letter: "F" },
];

const CATALOG: NonNullable<RepoEntry["catalog"]> = {
  has_file: true,
  has_entity: true,
  owner: "group:rg-mobile",
  owner_key: "rg-mobile",
  type: "service",
  lifecycle: "production",
  release: "main",
  interest: "none listed",
  description: "The `alpha` service.",
  links: [{ title: "Docs", url: "https://docs.example.org" }],
  relations: [{ label: "Depends on", target: "component:beta", suffix: " (not in catalog)" }],
  backstage_url: "https://backstage.openedx.org/catalog/default/component/alpha",
  findings: [
    { severity: "problem", label: "Owner not found" },
    { severity: "note", label: "No description" },
  ],
};

function repoEntry(overrides: Partial<RepoEntry> = {}): RepoEntry {
  return {
    summary: { available: 8, total: 9, coverage_pct: 72.5, level: "warn" },
    subscores: {
      structural: { value: 47.62, help: "Baseline compliance: README, CI, openedx.yaml, deps." },
      activity: { value: null, help: "Activity help. Withheld: only 30% of this category's weight is measured." },
    },
    metric_bars: BARS,
    category_cards: [
      { name: "File Existence", pass: 3, fail: 15, na: 0, pass_rate: 16.666666666666664, level: "fail" },
      { name: "README", pass: 2, fail: 0, na: 2, pass_rate: 100, level: "pass" },
      { name: "Documentation", pass: 0, fail: 0, na: 2, pass_rate: null, level: "unknown" },
    ],
    catalog: CATALOG,
    ...overrides,
  };
}

function detailView(entry: RepoEntry = repoEntry(), catalogAvailable = true): RepoDetailView {
  return {
    metadata: metadata("repo_detail"),
    catalog_available: catalogAvailable,
    catalog_collected_at: "2026-10-03T14:00:01.000711+00:00",
    repos: { [REPO]: entry, "openedx/beta": repoEntry({ catalog: null }) },
  };
}

function reposView(signals: Record<string, unknown> = {}) {
  return {
    metadata: metadata("repos"),
    records: [
      {
        repo_name: REPO,
        score_composite: 41.25,
        score_letter: "C",
        score_config_version: "2.0",
        checks: { "exists.README.rst": "pass", "dependabot.exists": "fail", "docs.readthedocs": "unknown" },
        category_stats: {},
        owner_handles: [],
        ...signals,
      },
      { repo_name: "openedx/beta", score_composite: 80, score_letter: "A", checks: {}, category_stats: {}, owner_handles: [] },
    ],
  };
}

function checkRecord(check: string, category: string | null, overrides: Partial<CheckRecord> = {}): CheckRecord {
  return {
    check,
    title: check.toUpperCase(),
    category,
    description: { description: `About ${check}.` },
    populated_pct: 100,
    pass_pct: 50,
    scored_by: null,
    has_remediation: false,
    remediation: null,
    pr_template: null,
    ...overrides,
  };
}

const REMEDIATION = {
  title: "Add Dependabot configuration",
  description: "Dependabot keeps dependency versions fresh.",
  source_url: "https://github.com/openedx/.github/blob/main/dependabot.yml",
  snippet: "version: 2\n",
  issue_body: "Fails `dependabot.exists`.\n\nFiled via the dashboard (https://openedx.ossvitals.org).\n",
};

const PR_TEMPLATE = { branch: "chore/dependabot-config", title: "chore: add dependabot config", body: "## Generated\nReview & merge." };

function checksView(prTemplate: CheckRecord["pr_template"] = PR_TEMPLATE): ChecksView {
  return {
    metadata: metadata("checks"),
    records: [
      checkRecord("exists.README.rst", "README"),
      checkRecord("dependabot.exists", "File Existence", { has_remediation: true, remediation: REMEDIATION, pr_template: prTemplate }),
      checkRecord("docs.readthedocs", "Documentation", { description: null }),
      checkRecord("unrelated.check", null),
    ],
    review_window: { snapshots: 0, first: null, last: null },
    up_for_review: [],
    candidates: [],
    groups: [],
  };
}

const SIGNALS = [
  { column: "github.issues_open", label: "Open issues", group: "Issues", kind: "count" },
  { column: "github.issue_closure_ratio_90d", label: "Closed of those", group: "Issues", kind: "ratio" },
  { column: "github.median_issue_first_response_seconds", label: "Median first response", group: "Issues", kind: "duration" },
  { column: "github.oldest_open_pr_days", label: "Oldest open PR", group: "Pull requests", kind: "days" },
  { column: "github.default_branch_ci_state", label: "Default-branch CI", group: "Pull requests", kind: "state" },
  { column: "github.first_timer_prs_90d", label: "First-timer PRs (90 days)", group: "Newcomers", kind: "count" },
  { column: "github.good_first_issues_open", label: "Good first issues open", group: "Newcomers", kind: "count" },
] as const;

const SIGNAL_VALUES = {
  "github.issues_open": 1234,
  "github.issue_closure_ratio_90d": 0.456,
  "github.median_issue_first_response_seconds": 172800,
  "github.oldest_open_pr_days": 1,
  "github.default_branch_ci_state": "FAILURE",
  "github.first_timer_prs_90d": 0,
  "github.good_first_issues_open": null,
};

interface Setup {
  detail?: RepoDetailView;
  signals?: Record<string, unknown>;
  unmeasured?: string[];
  prTemplate?: CheckRecord["pr_template"];
}

function setViews({ detail = detailView(), signals = SIGNAL_VALUES, unmeasured = [], prTemplate = PR_TEMPLATE }: Setup = {}) {
  views.current = {
    repos: ready(reposView(signals)),
    repo_detail: ready(detail),
    meta: ready(metaFixture({ signals: [...SIGNALS] })),
    overview: ready(overviewFixture({ unmeasured_columns: unmeasured })),
    checks: ready(checksView(prTemplate)),
    repo_checks: ready({
      metadata: metadata("repo_checks"),
      repos: { [REPO]: { "exists.README.rst": "True", "dependabot.exists": "False", "docs.readthedocs": null } },
    }),
    repo_history: ready({
      metadata: metadata("repo_history"),
      dates: ["2026-10-01", "2026-10-02", "2026-10-03"],
      repos: { [REPO]: { "File Existence": [10, null, 16.67], README: [null, null, 100] } },
    }),
  };
}

function withPrTemplates(enabled: boolean): SiteMeta {
  return { ...DEFAULT_SITE_META, featureFlags: { ...DEFAULT_SITE_META.featureFlags, enablePrTemplateGenerator: enabled } };
}

beforeEach(() => setViews());

describe("Repo Detail page", () => {
  it("shows the first repository when none is requested, as Streamlit does", async () => {
    renderRoute("/repo_detail");
    expect(await screen.findByRole("heading", { level: 2, name: REPO })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Repo Detail · Open edX Repo Health"));
    expect(screen.getByRole("combobox", { name: "Repository" })).toHaveValue("");
  });

  it("shows the best match for an unknown ?repo=", async () => {
    renderRoute("/repo_detail?repo=beta");
    expect(await screen.findByRole("heading", { level: 2, name: "openedx/beta" })).toBeInTheDocument();
  });

  it("asks for a repository when the snapshot has none", async () => {
    views.current = { ...views.current, repos: ready({ ...reposView(), records: [] }) };
    renderRoute("/repo_detail");
    expect(await screen.findByText("Pick a repository to see its detail.")).toBeInTheDocument();
  });

  it("filters the repository combobox as you type and selects with Enter", async () => {
    const { router } = renderRoute(PATH);
    const combobox = await screen.findByRole("combobox", { name: "Repository" });
    expect(combobox).toHaveAttribute("aria-expanded", "false");

    await userEvent.clear(combobox);
    await userEvent.type(combobox, "bet");
    expect(combobox).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox", { name: "Repositories" });
    expect(combobox).toHaveAttribute("aria-controls", listbox.id);
    expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toEqual(["openedx/beta"]);
    expect(combobox).toHaveAttribute("aria-activedescendant", within(listbox).getByRole("option").id);

    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { level: 2, name: "openedx/beta" })).toBeInTheDocument();
    expect(combobox).toHaveValue("openedx/beta");
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(router.state.location.search).toBe("?repo=openedx%2Fbeta");
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("opens the full list with the arrow keys from the current repository", async () => {
    renderRoute(PATH);
    const combobox = await screen.findByRole("combobox", { name: "Repository" });
    combobox.focus();

    await userEvent.keyboard("{ArrowDown}");
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["openedx/alpha", "openedx/beta"]);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(await screen.findByRole("heading", { level: 2, name: "openedx/beta" })).toBeInTheDocument();
  });

  it("closes the list with Escape without changing the repository", async () => {
    renderRoute(PATH);
    const combobox = await screen.findByRole("combobox", { name: "Repository" });
    await userEvent.type(combobox, "x");
    expect(combobox).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("heading", { level: 2, name: REPO })).toBeInTheDocument();
  });

  it("selects a repository with a click", async () => {
    renderRoute(PATH);
    const combobox = await screen.findByRole("combobox", { name: "Repository" });
    await userEvent.click(combobox);
    await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "openedx/beta" }));
    expect(await screen.findByRole("heading", { level: 2, name: "openedx/beta" })).toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    renderRoute(PATH);
    const combobox = await screen.findByRole("combobox", { name: "Repository" });
    await userEvent.clear(combobox);
    await userEvent.type(combobox, "zzz");
    expect(screen.getByText("No repository matches.")).toBeInTheDocument();
    expect(combobox).not.toHaveAttribute("aria-activedescendant");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 2, name: REPO })).toBeInTheDocument();
  });

  it("follows ?repo= when it changes from outside the picker", async () => {
    const { router } = renderRoute(PATH);
    const combobox = await screen.findByRole("combobox", { name: "Repository" });
    await act(() => router.navigate("/repo_detail?repo=openedx%2Fbeta"));
    expect(await screen.findByRole("heading", { level: 2, name: "openedx/beta" })).toBeInTheDocument();
    expect(combobox).toHaveValue("openedx/beta");
  });

  it("renders the header chip, KPI tiles and a withheld sub-score", async () => {
    renderRoute(PATH);
    expect(await screen.findByRole("heading", { level: 2, name: REPO })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Repository" })).toHaveValue(REPO);
    expect(screen.getByRole("img", { name: "Grade C" })).toBeInTheDocument();
    expect(screen.getByText("8/9 metrics (72% weight)")).toHaveClass("status-chip--warn");
    expect(within(screen.getByRole("group", { name: "Composite" })).getByText("41.2")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Grade" })).getByText("C")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Structural" })).getByText("47.6")).toBeInTheDocument();
    const activity = screen.getByRole("group", { name: "Activity" });
    expect(within(activity).getByText("—")).toBeInTheDocument();
    expect(within(activity).getByText(/Withheld: only 30%/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link to this view" })).toBeInTheDocument();
  });

  it("renders the metric bar chart summary and caption", async () => {
    renderRoute(PATH);
    expect(await screen.findByText("2 of 4 metrics measured")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Metric scores: ci_status 100, commit_recency 42/ })).toBeInTheDocument();
    expect(
      screen.getByText("Scoring config 2.0 · bars show each metric's contribution; unmeasured metrics are marked."),
    ).toBeInTheDocument();
  });

  it("formats activity signals by kind and skips empty and unmeasured columns", async () => {
    setViews({ unmeasured: ["github.first_timer_prs_90d"] });
    renderRoute(PATH);
    const activity = await screen.findByRole("region", { name: "Activity" });
    const groups = within(activity).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(groups).toEqual(["Issues", "Pull requests"]);
    const items = within(activity).getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual([
      "Open issues: 1,234",
      "Closed of those: 46%",
      "Median first response: 2.0 days",
      "Oldest open PR: 1 day",
      "Default-branch CI: Failure",
    ]);
    expect(
      within(activity).getByText(
        "Counts and medians only; newcomers are PR authors with no earlier commit in the repo. Newcomer counts are hidden: this snapshot reports none for any repository, which is a collection gap.",
      ),
    ).toBeInTheDocument();
  });

  it("shows zero counts and the plain note when nothing is unmeasured", async () => {
    renderRoute(PATH);
    const activity = await screen.findByRole("region", { name: "Activity" });
    expect(within(activity).getAllByRole("listitem").map((item) => item.textContent)).toContain("First-timer PRs (90 days): 0");
    expect(
      within(activity).getByText("Counts and medians only; newcomers are PR authors with no earlier commit in the repo."),
    ).toBeInTheDocument();
  });

  it("says so when the repository reports no signals", async () => {
    setViews({ signals: Object.fromEntries(Object.keys(SIGNAL_VALUES).map((column) => [column, null])) });
    renderRoute(PATH);
    const activity = await screen.findByRole("region", { name: "Activity" });
    expect(within(activity).getByText("This repository reports no issue, PR or CI signals in this snapshot.")).toBeInTheDocument();
  });

  it("says so when the snapshot carries no signal columns at all", async () => {
    setViews({ signals: {} });
    renderRoute(PATH);
    const activity = await screen.findByRole("region", { name: "Activity" });
    expect(within(activity).getByText("Issue, PR backlog, CI and newcomer signals are not in this snapshot yet.")).toBeInTheDocument();
  });

  it("renders the catalog facts, links, relations and findings", async () => {
    renderRoute(PATH);
    const catalog = await screen.findByRole("region", { name: "Catalog" });
    expect(within(catalog).getByRole("link", { name: "group:rg-mobile" })).toHaveAttribute(
      "href",
      "/ownership_views?owner=rg-mobile",
    );
    expect(within(catalog).getByText("service").tagName).toBe("STRONG");
    expect(within(catalog).getByText("Architecture interest: none listed")).toBeInTheDocument();
    expect(within(catalog).getByText("alpha").tagName).toBe("CODE");
    expect(within(catalog).getByRole("link", { name: "Docs" })).toHaveAttribute("href", "https://docs.example.org");
    expect(within(catalog).getByText(/^Depends on:/)).toHaveTextContent("Depends on: component:beta (not in catalog)");
    expect(within(catalog).getByRole("link", { name: "Open in Backstage" })).toBeInTheDocument();
    expect(within(catalog).getByText("Owner not found")).toHaveClass("status-chip--fail");
    expect(within(catalog).getByText("No description")).toHaveClass("status-chip--warn");
    expect(within(catalog).getByText(/collected 2026-10-03\. User owners are checked against GitHub/)).toBeInTheDocument();
  });

  it("shows the owner as plain code when it has no owner key", async () => {
    setViews({ detail: detailView(repoEntry({ catalog: { ...CATALOG, owner_key: null } })) });
    renderRoute(PATH);
    const catalog = await screen.findByRole("region", { name: "Catalog" });
    expect(within(catalog).getByText("group:rg-mobile").closest("a")).toBeNull();
  });

  it.each([
    ["no catalog snapshot", detailView(repoEntry(), false), "No catalog snapshot for this repository yet."],
    ["no entry", detailView(repoEntry({ catalog: null })), "No catalog snapshot for this repository yet."],
    ["no file", detailView(repoEntry({ catalog: { ...CATALOG, has_file: false } })), "This repository has no catalog-info.yaml."],
    ["no entity", detailView(repoEntry({ catalog: { ...CATALOG, has_entity: false } })), "catalog-info.yaml is empty or not valid YAML."],
  ])("renders the catalog empty state for %s", async (_name, detail, message) => {
    setViews({ detail });
    renderRoute(PATH);
    const catalog = await screen.findByRole("region", { name: "Catalog" });
    expect(within(catalog).getByText(message)).toBeInTheDocument();
  });

  it("links OEP-55 when the repository has no catalog file", async () => {
    setViews({ detail: detailView(repoEntry({ catalog: { ...CATALOG, has_file: false } })) });
    renderRoute(PATH);
    const catalog = await screen.findByRole("region", { name: "Catalog" });
    expect(within(catalog).getByRole("link", { name: "OEP-55" })).toHaveAttribute(
      "href",
      "https://open-edx-proposals.readthedocs.io/en/latest/processes/oep-0055-proc-project-maintainers.html",
    );
  });

  it("renders category cards with level chips and sparklines", async () => {
    renderRoute(PATH);
    const cards = await screen.findByRole("region", { name: "Category overview" });
    const files = within(cards).getByRole("group", { name: "File Existence" });
    expect(within(files).getByText("17% pass")).toHaveClass("status-chip--fail");
    expect(within(files).getByText("Pass 3 · Fail 15 · N/A 0")).toBeInTheDocument();
    expect(within(files).getByRole("img", { name: "File Existence pass rate over 2 snapshots" })).toBeInTheDocument();
    const readme = within(cards).getByRole("group", { name: "README" });
    expect(within(readme).getByText("100% pass")).toHaveClass("status-chip--pass");
    expect(within(readme).queryByRole("img")).toBeNull();
    const docs = within(cards).getByRole("group", { name: "Documentation" });
    expect(within(docs).getByText("no data")).toHaveClass("status-chip--unknown");
  });

  it("lists failing checks by default with values and remediation links", async () => {
    renderRoute(PATH);
    const checks = await screen.findByRole("region", { name: "Checks" });
    expect(within(checks).getByRole("radio", { name: "Failing" })).toBeChecked();
    expect(within(checks).getByText("1 of 3 checks shown.")).toBeInTheDocument();
    const entry = within(checks).getByText("DEPENDABOT.EXISTS").closest("details") as HTMLElement;
    expect(within(entry).getByText("FAIL", { selector: "summary code" })).toBeInTheDocument();
    expect(within(entry).getByText("FAIL", { selector: ".status-chip" })).toHaveClass("status-chip--fail");
    expect(within(entry).getByText(/About dependabot\.exists\./)).toBeInTheDocument();
    expect(within(entry).getByText("False", { selector: "code" })).toBeInTheDocument();
    expect(within(entry).getByText("Remediation")).toBeInTheDocument();
    expect(within(entry).getByText("version: 2")).toBeInTheDocument();
    expect(within(entry).getByRole("link", { name: "Source" })).toHaveAttribute("href", REMEDIATION.source_url);
    expect(within(entry).getByRole("link", { name: "File issue on this repo" })).toHaveAttribute(
      "href",
      githubIssueUrl(REPO, "dependabot.exists", REMEDIATION.issue_body),
    );
    expect(within(entry).getByRole("link", { name: "Open PR with fix" })).toHaveAttribute(
      "href",
      githubPrCompareUrl(REPO, PR_TEMPLATE),
    );
  });

  it("reads the filter and category from the URL", async () => {
    renderRoute(`${PATH}&filter=All&category=Documentation`);
    const checks = await screen.findByRole("region", { name: "Checks" });
    expect(within(checks).getByRole("radio", { name: "All" })).toBeChecked();
    const category = within(checks).getByLabelText("Category");
    expect(category).toHaveValue("Documentation");
    expect(within(category).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "All",
      "File Existence",
      "README",
      "Documentation",
    ]);
    expect(within(checks).getByText("1 of 3 checks shown.")).toBeInTheDocument();
    const entry = within(checks).getByText("DOCS.READTHEDOCS").closest("details") as HTMLElement;
    expect(within(entry).getByText("—", { selector: "summary code" })).toBeInTheDocument();
    expect(within(entry).getByText("UNKNOWN")).toHaveClass("status-chip--unknown");
    expect(within(entry).getByText(/No description available\./)).toBeInTheDocument();
    expect(within(entry).getByText("not recorded").tagName).toBe("EM");
  });

  it("changes the filter and shows the empty state when nothing matches", async () => {
    renderRoute(`${PATH}&category=README`);
    const checks = await screen.findByRole("region", { name: "Checks" });
    expect(within(checks).getByText("No checks match this filter.")).toBeInTheDocument();
    await userEvent.click(within(checks).getByRole("radio", { name: "Passing" }));
    expect(within(checks).getByText("1 of 3 checks shown.")).toBeInTheDocument();
    const entry = within(checks).getByText("EXISTS.README.RST").closest("details") as HTMLElement;
    expect(within(entry).getByText("PASS", { selector: "summary code" })).toBeInTheDocument();
    expect(within(entry).queryByText("Remediation")).toBeNull();
  });

  it("hides the PR link when the flag is off", async () => {
    renderRoute(PATH, withPrTemplates(false));
    const checks = await screen.findByRole("region", { name: "Checks" });
    expect(within(checks).getByRole("link", { name: "File issue on this repo" })).toBeInTheDocument();
    expect(within(checks).queryByRole("link", { name: "Open PR with fix" })).toBeNull();
  });

  it("reports a check data failure instead of loading forever", async () => {
    views.current = { ...views.current, checks: { status: "error", data: undefined, error: new Error("bad checks") } };
    renderRoute(PATH);
    expect(await screen.findByText("The check data could not be loaded.")).toBeInTheDocument();
  });

  it("hides the PR link when the check has no template", async () => {
    setViews({ prTemplate: null });
    renderRoute(PATH);
    const checks = await screen.findByRole("region", { name: "Checks" });
    expect(within(checks).queryByRole("link", { name: "Open PR with fix" })).toBeNull();
  });

});

describe("metricBarsChart", () => {
  it("keeps the payload order top to bottom and marks each state", () => {
    const chart = metricBarsChart(BARS);
    expect(chart.summary).toBe("2 of 4 metrics measured");
    expect(chart.spec.options.y).toMatchObject({ domain: ["ci_status", "commit_recency", "pr_response_time", "release_frequency"] });
    const [bars, labels] = chart.spec.marks;
    expect(bars && "data" in bars && bars.data).toEqual([
      { metric: "ci_status", state: "measured", value: 100, label: "100", fill: "var(--grade-a)" },
      { metric: "commit_recency", state: "measured", value: 42.5, label: "42", fill: "var(--grade-c)" },
      expect.objectContaining({ metric: "pr_response_time", state: "defaulted", value: 50, label: "default (50)" }),
    ]);
    expect(((labels && "data" in labels ? labels.data : []) as { label: string }[]).map((entry) => entry.label)).toEqual([
      "100",
      "42",
      "default (50)",
      "not collected",
    ]);
  });
});

describe("chart specs", () => {
  it("render with Observable Plot", () => {
    const bars = renderPlot(metricBarsChart(BARS).spec, 640, "Metric scores");
    expect(bars.querySelectorAll("rect")).toHaveLength(3);
    expect(bars.textContent).toContain("not collected");
    const points = ratePoints(["2026-10-01", "2026-10-02", "2026-10-03"], [10, null, 16.67]);
    const spark = categorySparkline("README", points);
    expect(spark && renderPlot(spark.spec, 200, "Spark").querySelector("path")).not.toBeNull();
  });
});

describe("formatSignal", () => {
  it.each([
    ["count", 1234567, "1,234,567"],
    ["count", 12.9, "12"],
    ["ratio", 0.125, "12%"],
    ["ratio", 1, "100%"],
    ["days", 1, "1 day"],
    ["days", 1500, "1,500 days"],
    ["duration", 5400, "1.5 h"],
    ["duration", 86400, "1.0 days"],
    ["state", " success ", "Success"],
    ["state", "FAILURE", "Failure"],
  ] as const)("formats %s %s as %s", (kind, value, expected) => {
    expect(formatSignal(kind, value)).toBe(expected);
  });
});

describe("section nav", () => {
  function sectionLinks() {
    return within(screen.getByRole("navigation", { name: "Repository sections" })).getAllByRole("link");
  }

  it("links every section to an anchor on the page", async () => {
    renderRoute(PATH);
    await screen.findByRole("heading", { level: 2, name: REPO });
    const links = sectionLinks();
    expect(links.map((link) => link.textContent)).toEqual(["Scores", "Activity", "Catalog", "Categories", "Checks"]);
    for (const link of links) {
      const target = document.getElementById((link.getAttribute("href") ?? "").slice(1));
      expect(target).not.toBeNull();
    }
    expect(document.getElementById("repo-activity")).toContainElement(screen.getByRole("region", { name: "Activity" }));
    expect(document.getElementById("repo-checks")).toContainElement(screen.getByRole("region", { name: "Checks" }));
    expect(links[0]).toHaveAttribute("aria-current", "location");
  });

  it("jumps to a section, marks it current and moves focus there", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { router } = renderRoute(PATH);
    await screen.findByRole("heading", { level: 2, name: REPO });

    await userEvent.click(screen.getByRole("link", { name: "Catalog" }));

    expect(screen.getByRole("link", { name: "Catalog" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: "Scores" })).not.toHaveAttribute("aria-current");
    expect(document.getElementById("repo-catalog")).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(router.state.location.search).toBe(`?repo=${encodeURIComponent(REPO)}`);
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  });

  it("highlights the section scrolled into the top band", async () => {
    const observers: { callback: IntersectionObserverCallback }[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          observers.push({ callback });
        }
        observe() {}
        disconnect() {}
      },
    );
    renderRoute(PATH);
    await screen.findByRole("heading", { level: 2, name: REPO });
    const entry = (id: string, isIntersecting: boolean) =>
      ({ target: document.getElementById(id), isIntersecting }) as unknown as IntersectionObserverEntry;

    act(() =>
      observers.at(-1)?.callback([entry("repo-scores", false), entry("repo-categories", true)], {} as IntersectionObserver),
    );

    expect(screen.getByRole("link", { name: "Categories" })).toHaveAttribute("aria-current", "location");
    vi.unstubAllGlobals();
  });

  it("picks the first visible section in page order", () => {
    expect(firstVisible(["a", "b", "c"], new Set(["c", "b"]))).toBe("b");
    expect(firstVisible(["a"], new Set())).toBeNull();
  });
});

describe("GitHub URL builders", () => {
  it("builds the issue URL with a stripped body", () => {
    const url = new URL(githubIssueUrl(REPO, "dependabot.exists", "  Body with `code` & spaces.\n"));
    expect(`${url.origin}${url.pathname}`).toBe("https://github.com/openedx/alpha/issues/new");
    expect([...url.searchParams.entries()]).toEqual([
      ["title", "[Repo health] Fix failing check: dependabot.exists"],
      ["body", "Body with `code` & spaces."],
    ]);
    expect(url.search).toContain("title=%5BRepo+health%5D+Fix+failing+check%3A+dependabot.exists");
  });

  it("builds the compare URL with the branch in the path", () => {
    const url = new URL(githubPrCompareUrl(REPO, PR_TEMPLATE));
    expect(`${url.origin}${url.pathname}`).toBe("https://github.com/openedx/alpha/compare/main...chore/dependabot-config");
    expect([...url.searchParams.entries()]).toEqual([
      ["quick_pull", "1"],
      ["title", "chore: add dependabot config"],
      ["body", "## Generated\nReview & merge."],
    ]);
  });
});

describe("rankRepos", () => {
  const repos = ["openedx/edx-platform", "openedx/frontend-platform", "openedx/platform", "openedx/xblock", "openedx/credentials"];

  it("lists every repo sorted when the query is empty", () => {
    expect(rankRepos([...repos].reverse(), "  ")).toEqual([...repos].sort());
  });

  it("prefers an exact match, then the earliest substring, then subsequences", () => {
    expect(rankRepos(repos, "openedx/platform")).toEqual(["openedx/platform", "openedx/edx-platform", "openedx/frontend-platform"]);
    expect(rankRepos(repos, "PLAT")).toEqual(["openedx/platform", "openedx/edx-platform", "openedx/frontend-platform"]);
    expect(rankRepos(repos, "xblk")).toEqual(["openedx/xblock"]);
    expect(rankRepos(repos, "zzz")).toEqual([]);
  });

  it("caps the options", () => {
    const many = Array.from({ length: 40 }, (_, index) => `openedx/repo-${String(index).padStart(2, "0")}`);
    expect(rankRepos(many, "repo")).toHaveLength(30);
  });
});

describe("unscored repositories", () => {
  beforeEach(() => setViews());

  it("reports a full repo name that is not scored instead of showing another repo", async () => {
    renderRoute("/repo_detail?repo=openedx%2Fwg-data");
    expect(await screen.findByText("openedx/wg-data is not scored in this snapshot.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open on GitHub" })).toHaveAttribute("href", "https://github.com/openedx/wg-data");
    expect(screen.queryByRole("heading", { level: 2, name: "openedx/alpha" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Repository" })).toHaveValue("openedx/wg-data");
  });

  it("can pick a scored repository from the unscored state", async () => {
    renderRoute("/repo_detail?repo=openedx%2Fwg-data");
    const combobox = await screen.findByRole("combobox", { name: "Repository" });
    await userEvent.clear(combobox);
    await userEvent.type(combobox, "alpha{Enter}");
    expect(await screen.findByRole("heading", { level: 2, name: REPO })).toBeInTheDocument();
    expect(screen.queryByText("openedx/wg-data is not scored in this snapshot.")).not.toBeInTheDocument();
  });

  it("shows the best match for a partial name and keeps the typed text", async () => {
    renderRoute("/repo_detail?repo=alp");
    expect(await screen.findByRole("heading", { level: 2, name: REPO })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Repository" })).toHaveValue("alp");
  });
});

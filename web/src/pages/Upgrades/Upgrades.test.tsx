import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type { UpgradesView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { renderRoute } from "../../test/renderRoute";
import { collectedTime, pullLabel, runsText } from "./upgradesText";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready<Name extends ViewName>(data: unknown): ViewState<Name> {
  return { status: "ready", data, error: undefined } as ViewState<Name>;
}

type Wave = UpgradesView["waves"][number];
type WaveRow = NonNullable<Wave["records"]>[number];

const MISSING_BODY = "It is published daily by the collect-maintenance workflow; check back after its next run.";

function job(repo_name: string, state: string, overrides: Record<string, unknown> = {}) {
  return {
    repo_name,
    state,
    reason: `${repo_name} reason`,
    "github.upgrade_job_runs_failed": 9,
    "github.upgrade_job_runs_total": 10,
    "github.requirements_pr_last_merged": "2025-04-30",
    workflow_url: `https://github.com/${repo_name}/actions/workflows/upgrade-python-requirements.yml`,
    ...overrides,
  };
}

function waveRow(repo_name: string, status: string, overrides: Partial<WaveRow> = {}): WaveRow {
  return { repo_name, status, pr_url: null, pr_title: null, pr_age_days: null, gaps: "", ...overrides };
}

function wave(overrides: Partial<Wave> = {}): Wave {
  return {
    id: "uv_pyproject",
    title: "Python packaging on pyproject.toml + uv",
    epic: "https://github.com/openedx/public-engineering/issues/506",
    done_rule: "has `uv.lock`, `pyproject.toml`; no `setup.py`",
    available: true,
    collected_at: "2026-10-03T10:33:00.075189+00:00",
    summary: { not_started: 42, pr_open: 23, done: 41, not_applicable: 76, applicable: 106, percent_done: 39 },
    records: [
      waveRow("openedx/young", "pr_open", { pr_url: "https://github.com/openedx/young/pull/12", pr_title: "feat: uv", pr_age_days: 3 }),
      waveRow("openedx/old", "pr_open", { pr_url: "https://github.com/openedx/old/pull/88", pr_title: "build: uv", pr_age_days: 40 }),
      waveRow("openedx/acid-block", "not_started", { gaps: "add uv.lock, remove setup.py" }),
      waveRow("openedx/finished", "done"),
    ],
    ...overrides,
  };
}

function upgradesFixture(overrides: Partial<UpgradesView> = {}): UpgradesView {
  return {
    metadata: metadata("collect-maintenance files"),
    upgrade_jobs: {
      collected_at: "2026-10-03T10:30:09.732527+00:00",
      states: { failing: 45, not_landing: 14, healthy: 30 },
      records: [
        job("openedx/failing-repo", "failing", { "github.requirements_pr_last_merged": null }),
        job("openedx/stuck-repo", "not_landing"),
        job("openedx/healthy-repo", "healthy"),
      ],
    },
    waves: [wave()],
    redundant_prs: {
      collected_at: "2026-10-03T10:33:18.603853+00:00",
      redundant: 27,
      bot_prs_checked: 30,
      records: [
        {
          repo_name: "openedx/acid-block",
          bot_pr_url: "https://github.com/openedx/acid-block/pull/265",
          superseded_by_url: "https://github.com/openedx/acid-block/pull/267",
          superseded_by_merged: "2026-05-30",
          confidence: "conflicts with default branch",
        },
      ],
    },
    ...overrides,
  };
}

function setUpgrades(view: UpgradesView) {
  views.current = { upgrades: ready(view) };
}

function tile(label: string): HTMLElement {
  return screen.getByRole("group", { name: label });
}

function columnTexts(table: HTMLElement, column: number): (string | null)[] {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[column]?.textContent ?? null);
}

async function openTab(name: string) {
  await userEvent.click(await screen.findByRole("tab", { name }));
}

beforeEach(() => setUpgrades(upgradesFixture()));

describe("Upgrades page", () => {
  it("shows the title, intro and tabs in Streamlit order", async () => {
    renderRoute("/maintenance");

    expect(await screen.findByRole("heading", { level: 1, name: "Upgrades" })).toBeInTheDocument();
    expect(screen.getByText(/^Upgrade work across the org, from bot and human PRs alike/)).toHaveTextContent(
      "upgrade PRs that are no longer needed. Collected daily from public GitHub data; read-only.",
    );
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Upgrade jobs",
      "Wave: Python packaging on pyproject.toml + uv",
      "Redundant PRs",
    ]);
    expect(screen.getByRole("button", { name: "Copy link to this view" })).toBeInTheDocument();
  });

  it("shows the upgrade-job caption, tiles and explanation", async () => {
    renderRoute("/maintenance");

    const caption = await screen.findByText(/^Each repo's weekly/);
    expect(caption).toHaveTextContent(
      "Each repo's weekly upgrade-python-requirements.yml job, from repo-tools' check_requirements_failures. Collected 2026-10-03 10:30 UTC.",
    );
    expect(within(caption).getByText("upgrade-python-requirements.yml", { selector: "code" })).toBeInTheDocument();
    expect(within(caption).getByText("check_requirements_failures", { selector: "code" })).toBeInTheDocument();
    expect(tile("Job failing")).toHaveTextContent("45");
    expect(tile("PRs not merged")).toHaveTextContent("14");
    expect(tile("Healthy")).toHaveTextContent("30");
    expect(screen.getByText(/^Job failing: half or more of the last 10 runs failed/)).toBeInTheDocument();
  });

  it("hides healthy repos until the toggle is switched on", async () => {
    renderRoute("/maintenance");

    const toggle = await screen.findByRole("switch", { name: "Include healthy repos" });
    expect(toggle).not.toBeChecked();
    const table = screen.getByRole("table", { name: "Upgrade jobs" });
    expect(columnTexts(table, 0)).toEqual(["openedx/failing-repo", "openedx/stuck-repo"]);
    expect(columnTexts(table, 1)).toEqual(["Job failing", "PRs not merged"]);
    expect(columnTexts(table, 3)).toEqual(["9 / 10", "9 / 10"]);
    expect(columnTexts(table, 4)).toEqual(["never", "2025-04-30"]);
    expect(within(table).getAllByRole("link", { name: "Runs" })[0]).toHaveAttribute(
      "href",
      "https://github.com/openedx/failing-repo/actions/workflows/upgrade-python-requirements.yml",
    );

    await userEvent.click(toggle);

    expect(columnTexts(screen.getByRole("table", { name: "Upgrade jobs" }), 0)).toContain("openedx/healthy-repo");
  });

  it("shows the empty message when no repo is in a shown state", async () => {
    setUpgrades(
      upgradesFixture({
        upgrade_jobs: { collected_at: null, states: { healthy: 1 }, records: [job("openedx/healthy-repo", "healthy")] },
      }),
    );
    renderRoute("/maintenance");

    expect(await screen.findByText("No repos in these states.")).toBeInTheDocument();
  });

  it("shows the missing state for upgrade jobs", async () => {
    setUpgrades(upgradesFixture({ upgrade_jobs: null }));
    renderRoute("/maintenance");

    const title = await screen.findByText("No upgrade-job data yet.");
    expect(title.closest(".empty-state")).toHaveClass("empty-state--info");
    expect(title.closest(".empty-state")).toHaveTextContent(MISSING_BODY);
  });

  it("shows the wave progress, tiles, caption and both tables", async () => {
    renderRoute("/maintenance");
    await openTab("Wave: Python packaging on pyproject.toml + uv");

    expect(screen.getByRole("link", { name: "tracking epic" })).toHaveAttribute(
      "href",
      "https://github.com/openedx/public-engineering/issues/506",
    );
    const progress = screen.getByRole("progressbar", { name: "41 of 106 repos done (39%)" });
    expect(progress).toHaveAttribute("aria-valuenow", "39");
    expect(tile("Done")).toHaveTextContent("41");
    expect(tile("PR open")).toHaveTextContent("23");
    expect(tile("Not started")).toHaveTextContent("42");
    const caption = screen.getByText(/^Done means:/);
    expect(caption).toHaveTextContent("Done means: has uv.lock, pyproject.toml; no setup.py. Collected 2026-10-03 10:33 UTC.");
    expect(within(caption).getByText("uv.lock", { selector: "code" })).toBeInTheDocument();

    const openPrs = screen.getByRole("table", { name: "Open migration PRs, oldest first" });
    expect(columnTexts(openPrs, 0)).toEqual(["openedx/old", "openedx/young"]);
    expect(columnTexts(openPrs, 1)).toEqual(["40", "3"]);
    expect(within(openPrs).getByRole("link", { name: "#88" })).toHaveAttribute("href", "https://github.com/openedx/old/pull/88");

    const notStarted = screen.getByRole("table", { name: "Not started" });
    expect(columnTexts(notStarted, 0)).toEqual(["openedx/acid-block"]);
    expect(columnTexts(notStarted, 1)).toEqual(["add uv.lock, remove setup.py"]);
  });

  it("shows the wave empty messages when nothing is open or not started", async () => {
    setUpgrades(upgradesFixture({ waves: [wave({ epic: null, records: [waveRow("openedx/finished", "done")] })] }));
    renderRoute("/maintenance");
    await openTab("Wave: Python packaging on pyproject.toml + uv");

    expect(screen.getByText("No migration PRs open.")).toBeInTheDocument();
    expect(screen.getByText("Every applicable repo has started.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "tracking epic" })).not.toBeInTheDocument();
  });

  it("shows the missing state for an unavailable wave", async () => {
    setUpgrades(upgradesFixture({ waves: [{ id: "x", title: "Node 24", epic: null, done_rule: "", available: false }] }));
    renderRoute("/maintenance");
    await openTab("Wave: Node 24");

    const title = screen.getByText("No Node 24 wave data yet.");
    expect(title.closest(".empty-state")).toHaveTextContent(MISSING_BODY);
  });

  it("shows the redundant PR caption, tiles and table", async () => {
    renderRoute("/maintenance");
    await openTab("Redundant PRs");

    expect(
      screen.getByText(
        "Bot campaign PRs made redundant by a later human campaign in the same repo. Dry run: nothing has been closed. Collected 2026-10-03 10:33 UTC.",
      ),
    ).toBeInTheDocument();
    expect(tile("Redundant")).toHaveTextContent("27");
    expect(tile("Bot campaign PRs checked")).toHaveTextContent("30");
    const table = screen.getByRole("table", { name: "Redundant bot PRs" });
    expect(within(table).getByRole("link", { name: "#265" })).toHaveAttribute(
      "href",
      "https://github.com/openedx/acid-block/pull/265",
    );
    expect(within(table).getByRole("link", { name: "#267" })).toBeInTheDocument();
    expect(columnTexts(table, 3)).toEqual(["2026-05-30"]);
    expect(columnTexts(table, 4)).toEqual(["conflicts with default branch"]);
  });

  it("shows the good empty state when no redundant PRs were found", async () => {
    setUpgrades(
      upgradesFixture({ redundant_prs: { collected_at: null, redundant: 0, bot_prs_checked: 12, records: [] } }),
    );
    renderRoute("/maintenance");
    await openTab("Redundant PRs");

    expect(screen.getByText("No redundant bot PRs found.").closest(".empty-state")).toHaveClass("empty-state--good");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the missing state for redundant PRs", async () => {
    setUpgrades(upgradesFixture({ redundant_prs: null }));
    renderRoute("/maintenance");
    await openTab("Redundant PRs");

    expect(screen.getByText("No redundant-PR data yet.").closest(".empty-state")).toHaveTextContent(MISSING_BODY);
  });

  it("switches panels between tabs", async () => {
    renderRoute("/maintenance");
    await openTab("Redundant PRs");

    expect(screen.getByRole("tab", { name: "Redundant PRs" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("switch", { name: "Include healthy repos" })).not.toBeInTheDocument();

    await openTab("Upgrade jobs");

    expect(screen.getByRole("switch", { name: "Include healthy repos" })).toBeInTheDocument();
  });
});

describe("upgrades text", () => {
  it("formats the collected time like Streamlit", () => {
    expect(collectedTime("2026-10-03T10:30:09.732527+00:00")).toBe("2026-10-03 10:30 UTC");
    expect(collectedTime(null)).toBe(" UTC");
  });

  it("labels pull request links by number and falls back to the URL", () => {
    expect(pullLabel("https://github.com/openedx/x/pull/42")).toBe("#42");
    expect(pullLabel("https://example.com/other")).toBe("https://example.com/other");
  });

  it("formats run counts", () => {
    expect(runsText(3, 10)).toBe("3 / 10");
  });
});

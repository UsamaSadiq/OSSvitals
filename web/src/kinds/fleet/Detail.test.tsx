import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPENEDX_SITE_META, renderRoute } from "../../test/renderRoute";
import { fleetTenant } from "./index";
import { clearFleetViews } from "./useFleetViews";

const monetaTenant = fleetTenant("moneta");

const META = { ...OPENEDX_SITE_META, name: "Moneta FOSS Status", tagline: "Drift", freshness: undefined, githubOrg: "Org" };
const metadata = { schema_version: 1, org: "moneta", generated_at: "2026-10-12T00:00:00Z" };

const APP = {
  repo: "burning",
  class: "fork",
  url: "https://github.com/Org/burning",
  description: "A burning fork",
  licence: "AGPL-3.0",
  licence_note: "Enterprise files are commercial",
  upstream: "up/burning",
  upstream_url: "https://github.com/up/burning",
  upstream_branch: "main",
  production_branch: "foss-main",
  purpose: null,
  what_we_changed: "Patched sign-in.",
  mcp_server: "burning-mcp",
  sso: "Working",
  e2e: "88 requirements",
  runbook_url: "https://example.org/runbook",
  pushed_at: "2026-10-01T00:00:00Z",
  open_pull_requests: 4,
  latest_tag: "v1.0.0",
};

const DRIFT = {
  repo: "burning",
  status: "critical",
  ahead_by: 3,
  behind_by: 900,
  behind_release: 700,
  ahead_release: 3,
  last_upstream_merge: "2026-09-01T00:00:00Z",
  days_since_upstream_merge: 20,
  fork_release: { tag: "v1.0.0", date: "2026-09-10T00:00:00Z" },
  release_candidate: { tag: "v1.1.0-rc.1" },
  upstream_release: { tag: "v2.0.0", date: null },
  status_basis: "release",
  release_gap: { base: "v1.5.0", base_ref: "v1.0.0", latest: "v2.0.0", releases_behind: 6, level: "major", days_behind: 40 },
  release_lag: { upstream_releases_since_sync: 6, upstream_ahead_of_our_release_days: 19 },
  advisories: {
    published: 4,
    since_fork_release: 2,
    severe_since_fork_release: 1,
    affecting_fork_release: 1,
    base_release: "v1.5.0",
    source: "github-published-advisories",
    items: [{ ghsa_id: "GHSA-1", severity: "high", summary: "Bad thing", url: "https://x/GHSA-1", published_at: "2026-09-12T00:00:00Z", after_our_release: true, affects_fork_release: true }],
  },
  promotion: { unpromoted_commits: 5 },
  ci: { state: "failing", total: 5 },
  pull_requests: { open: 2, sync_pull: { number: 4, title: "Sync", url: "https://x/4" } },
  maintainers: [{ login: "alice", merged: 12 }, { login: "bob", merged: 3 }],
  upstream_activity: { pushed_at: "2026-10-01T00:00:00Z", idle_days: 11, quiet: false },
  licence_watch: { present: true, path: "LICENSE", sha: "s1", spdx: "AGPL-3.0", declared: "AGPL-3.0", matches_declared: true, changed_on: null, previous_spdx: null },
};

const HISTORY = ["2026-09-01", "2026-09-02"].map((date, index) => ({
  date,
  repo: "burning",
  status: "critical",
  behind_by: 800 + index * 100,
  ahead_by: 3,
  advisories_since_release: 2,
}));

const CONFLICTS = [
  {
    repo: "burning",
    against_upstream_head: { clean: false, conflicted_files: ["server/auth.py"], conflicted_total: 1 },
    against_upstream_release: { tag: "v2.0.0", clean: true, conflicted_files: [], conflicted_total: 0 },
  },
];

function serve(files: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = files[url.split("/").pop() ?? ""];
      return new Response(JSON.stringify(body), { status: body ? 200 : 404, headers: { "Content-Type": "application/json" } });
    }),
  );
}

const FULL = {
  "apps.json": { metadata, records: [APP] },
  "drift.json": { metadata, records: [DRIFT] },
  "drift_history.json": { metadata, records: HISTORY },
  "conflicts.json": { metadata, records: CONFLICTS },
};

beforeEach(() => clearFleetViews());
afterEach(() => vi.unstubAllGlobals());

describe("Moneta app detail with the full data set", () => {
  beforeEach(() => serve(FULL));

  it("shows release, health and integration facts", async () => {
    renderRoute("/apps/burning", META, monetaTenant);
    await screen.findByRole("heading", { level: 1, name: /burning/ });
    for (const term of ["Release candidate pending", "Upstream releases since our last sync", "Checks on our release branch", "Open pull requests", "MCP server", "Single sign-on", "End-to-end tests", "Maintainers"]) {
      expect(screen.getByText(term)).toBeTruthy();
    }
    expect(screen.getByText("Failing")).toBeTruthy();
    expect(screen.getByText("alice (12), bob (3)")).toBeTruthy();
    expect(screen.getByText("Enterprise files are commercial")).toBeTruthy();
    expect(screen.getByRole("link", { name: "v1.0.0 (2026-09-10)" }).getAttribute("href")).toBe("https://github.com/Org/burning/tree/v1.0.0");
    expect(screen.getByRole("link", { name: "burning-mcp" }).getAttribute("href")).toBe("https://github.com/Org/burning-mcp");
    expect(screen.getByRole("link", { name: "Sync runbook" })).toBeTruthy();
  });

  it("lists advisories, the sync forecast and the badge snippet", async () => {
    renderRoute("/apps/burning", META, monetaTenant);
    await screen.findByRole("heading", { level: 2, name: "Upstream advisories" });
    expect(screen.getByRole("link", { name: "GHSA-1" }).getAttribute("href")).toBe("https://x/GHSA-1");
    expect(screen.getByText("1 file would conflict")).toBeTruthy();
    expect(screen.getByText("no conflicts expected")).toBeTruthy();
    expect(screen.getByText("server/auth.py")).toBeTruthy();
    expect(screen.getByText(/img\.shields\.io\/endpoint/)).toBeTruthy();
  });

  it("shows the distance to the latest upstream release and the advisories that match our base version", async () => {
    renderRoute("/apps/burning", META, monetaTenant);
    await screen.findByRole("heading", { level: 2, name: "Upstream advisories" });
    expect(screen.getByText("700 commits behind v2.0.0")).toBeTruthy();
    expect(screen.getByText("v1.5.0 → v2.0.0, 6 releases behind (a major version behind)")).toBeTruthy();
    expect(screen.getByText(/judged on upstream releases/)).toBeTruthy();
    expect(screen.getByText(/1 affecting v1\.5\.0, the upstream version we are based on/)).toBeTruthy();
    expect(screen.getByText("affects our base version")).toBeTruthy();
  });

  it("describes the trend in words", async () => {
    renderRoute("/apps/burning", META, monetaTenant);
    const figure = await screen.findByRole("img", { name: /falling behind/ });
    expect(figure.getAttribute("aria-label")).toContain("from 800 on 2026-09-01 to 900 on 2026-09-02");
  });
});

describe("Moneta app detail maintainers", () => {
  it.each([
    [[], "No pull requests merged in our fork yet"],
    [null, "Not available"],
  ])("explains %j", async (maintainers, text) => {
    serve({ ...FULL, "drift.json": { metadata, records: [{ ...DRIFT, maintainers }] } });
    renderRoute("/apps/burning", META, monetaTenant);
    expect(await screen.findByText(text)).toBeTruthy();
  });
});

describe("Moneta app detail with only the required views", () => {
  it("still renders, without the optional sections", async () => {
    serve({ "apps.json": FULL["apps.json"], "drift.json": FULL["drift.json"] });
    renderRoute("/apps/burning", META, monetaTenant);
    await screen.findByRole("heading", { level: 1, name: /burning/ });
    await waitFor(() => expect(screen.getByText("No history yet.")).toBeTruthy());
    expect(screen.queryByRole("heading", { name: "Sync forecast" })).toBeNull();
    expect(within(screen.getByRole("main")).queryByText("Open pull requests")).toBeTruthy();
  });
});

describe("Fleet app detail for a tenant that does not collect every signal", () => {
  it("renders the core facts and leaves out the signals that are absent", async () => {
    const core = Object.fromEntries(
      Object.entries(DRIFT).filter(([key]) => ["repo", "status", "status_basis", "ahead_by", "behind_by", "last_upstream_merge", "days_since_upstream_merge"].includes(key)),
    );
    serve({ "apps.json": FULL["apps.json"], "drift.json": { metadata, records: [core] } });
    renderRoute("/apps/burning", META, monetaTenant);
    await screen.findByRole("heading", { level: 1, name: /burning/ });
    expect(screen.getByText("Our patches")).toBeTruthy();
    expect(screen.queryByText("Upstream advisories")).toBeNull();
  });
});

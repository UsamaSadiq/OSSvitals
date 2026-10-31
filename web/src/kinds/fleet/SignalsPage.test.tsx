import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPENEDX_SITE_META, renderRoute } from "../../test/renderRoute";
import { fleetTenant } from "./index";
import { SIGNAL_CATALOGUE, type SignalKey } from "./signals";
import { clearFleetViews } from "./useFleetViews";
import { storageKey } from "./visibility";

const tenant = fleetTenant("moneta");
const META = { ...OPENEDX_SITE_META, name: "Moneta FOSS Status", tagline: "Drift", freshness: undefined, githubOrg: "Org" };
const metadata = { schema_version: 1, org: "moneta", generated_at: "2026-10-12T00:00:00Z" };
const MANIFEST_META = JSON.parse(readFileSync(resolve(__dirname, "../../../../tests/fixtures/moneta/views/meta.json"), "utf8"));

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
  exploitability: { basis: "release", considered: 3, without_cve: 1, known_exploited: [], kev_as_of: "2026-10-12", kev_from_cache: false },
};

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

/** `meta: null` serves no meta.json, like data published before the manifest existed. */
function files(meta: unknown = MANIFEST_META, drift: Record<string, unknown> = DRIFT) {
  return {
    "apps.json": { metadata, records: [APP] },
    "drift.json": { metadata, records: [drift] },
    "conflicts.json": { metadata, records: CONFLICTS },
    ...(meta === null ? {} : { "meta.json": meta }),
  };
}

/** Text that only that signal's detail-page fact or section renders. */
const DETAIL_MARKERS: Record<SignalKey, string> = {
  fork_release: "Our latest release",
  upstream_release: "Upstream latest release",
  release_gap: "Built on upstream",
  advisories: "Upstream advisories",
  promotion: "Not yet promoted",
  ci: "Checks on our release branch",
  pull_requests: "Open pull requests",
  maintainers: "Maintainers",
  upstream_activity: "Upstream activity",
  licence_watch: "Upstream licence",
  exploitability: "Known exploited",
  conflicts: "Sync forecast",
};

beforeEach(() => {
  clearFleetViews();
  window.localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("fleet pages follow the signal manifest", () => {
  it.each(SIGNAL_CATALOGUE.map((info) => info.key))("hides %s on the app page when the viewer hides it, and only then", async (key) => {
    serve(files());
    const { unmount } = renderRoute("/apps/burning", META, tenant);
    await screen.findByRole("heading", { level: 1, name: /burning/ });
    expect(screen.queryAllByText(DETAIL_MARKERS[key]).length).toBeGreaterThan(0);
    unmount();

    clearFleetViews();
    window.localStorage.setItem(storageKey("moneta"), JSON.stringify([key]));
    renderRoute("/apps/burning", META, tenant);
    await screen.findByRole("heading", { level: 1, name: /burning/ });
    expect(screen.queryAllByText(DETAIL_MARKERS[key])).toHaveLength(0);
    for (const [other, marker] of Object.entries(DETAIL_MARKERS)) {
      if (other !== key) expect(screen.queryAllByText(marker).length, other).toBeGreaterThan(0);
    }
  });

  it("keeps the advisory count on the app page but drops the base release when the release gap is hidden", async () => {
    window.localStorage.setItem(storageKey("moneta"), JSON.stringify(["release_gap"]));
    serve(files());
    renderRoute("/apps/burning", META, tenant);
    expect(await screen.findByText(/1 affecting the upstream release we are built on/)).toBeTruthy();
    expect(screen.queryByText(/v1\.5\.0, the upstream version we are based on/)).toBeNull();
  });

  it("shows a licence change on the card, the app page and needs attention", async () => {
    const changed = { ...DRIFT, licence_watch: { ...DRIFT.licence_watch, changed_on: "2026-10-30", previous_spdx: "AGPL-3.0" } };
    serve(files(MANIFEST_META, changed));
    const notice = "Upstream's licence file changed on 2026-10-30, still AGPL-3.0";
    const { router } = renderRoute("/apps", META, tenant);
    expect(within(await screen.findByRole("article", { name: "burning" })).getByText(notice)).toBeTruthy();
    await router.navigate("/attention");
    expect(await screen.findByText(notice)).toBeTruthy();
    await router.navigate("/apps/burning");
    const fact = (await screen.findByText("Upstream licence")).closest(".app-fact") as HTMLElement;
    expect(within(fact).getByText(notice)).toBeTruthy();
    expect(within(fact).getByRole("link", { name: "LICENSE on main" }).getAttribute("href")).toBe("https://github.com/up/burning/commits/main/LICENSE");
  });

  it("shows a known exploited advisory on the card, the app page and needs attention", async () => {
    const known = { ghsa_id: "GHSA-1", cve_id: "CVE-2026-1", severity: "high", date_added: "2026-10-02" };
    const exploited = { ...DRIFT, exploitability: { ...DRIFT.exploitability, known_exploited: [known] } };
    serve(files(MANIFEST_META, exploited));
    const notice = "CVE-2026-1 is in CISA's known exploited vulnerabilities catalog";
    const { router } = renderRoute("/apps", META, tenant);
    expect(within(await screen.findByRole("article", { name: "burning" })).getByText(notice)).toBeTruthy();
    await router.navigate("/attention");
    expect(await screen.findByText(notice)).toBeTruthy();
    await router.navigate("/apps/burning");
    const fact = (await screen.findByText("Known exploited", { selector: "dt" })).closest(".app-fact") as HTMLElement;
    expect(within(fact).getByRole("link", { name: "CVE-2026-1" }).getAttribute("href")).toBe("https://github.com/up/burning/security/advisories/GHSA-1");
    expect(within(fact).getByText(/3 advisories affecting the upstream release we are built on, 1 without a CVE id/)).toBeTruthy();
  });

  it("says when upstream has no licence file", async () => {
    const absent = { ...DRIFT, licence_watch: { ...DRIFT.licence_watch, present: false, path: null, sha: null, spdx: null } };
    serve(files(MANIFEST_META, absent));
    renderRoute("/apps/burning", META, tenant);
    expect(await screen.findByText("No licence file on main")).toBeTruthy();
  });

  it("hides a signal the tenant does not collect everywhere, including its table column and filter chip", async () => {
    const off = structuredClone(MANIFEST_META);
    off.fleet.signals.advisories = { ...off.fleet.signals.advisories, collect: false, show: [] };
    const { advisories: _advisories, ...withoutAdvisories } = DRIFT;
    serve(files(off, withoutAdvisories));
    renderRoute("/apps", META, tenant);
    await screen.findAllByRole("article");
    expect(screen.queryByRole("button", { name: "New advisories" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    expect(screen.queryByRole("columnheader", { name: /New advisories/ })).toBeNull();
    expect(screen.getByRole("columnheader", { name: /Built on upstream/ })).toBeTruthy();
  });

  it("shows everything when the published data has no manifest yet, even signals the viewer hid", async () => {
    window.localStorage.setItem(storageKey("moneta"), JSON.stringify(["ci"]));
    serve(files(null));
    renderRoute("/apps/burning", META, tenant);
    await screen.findByRole("heading", { level: 1, name: /burning/ });
    for (const marker of Object.values(DETAIL_MARKERS)) {
      expect(screen.queryAllByText(marker).length).toBeGreaterThan(0);
    }
  });
});

describe("Signals panel", () => {
  it("lists every signal with its state, surfaces and the statuses it can decide", async () => {
    serve(files());
    renderRoute("/signals", META, tenant);
    const list = await screen.findByRole("list", { name: "Signals" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => within(row).getByRole("heading").textContent)).toEqual(SIGNAL_CATALOGUE.map((info) => info.label));
    const advisories = screen.getByRole("listitem", { name: "Security advisories" });
    expect(within(advisories).getByText("Shown")).toBeTruthy();
    expect(within(advisories).getByText(/fork cards, apps table, app pages/)).toBeTruthy();
    expect(within(advisories).getByText("severe: critical, high")).toBeTruthy();
    expect(within(advisories).getByText("Critical")).toBeTruthy();
  });

  it("hides a signal across the dashboard from one switch and remembers it", async () => {
    serve(files());
    const { router } = renderRoute("/signals", META, tenant);
    const ci = await screen.findByRole("listitem", { name: "Checks" });
    fireEvent.click(within(ci).getByRole("switch", { name: "Show checks in my view" }));
    expect(within(ci).getByText("Hidden by you")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(storageKey("moneta")) ?? "[]")).toEqual(["ci"]);
    await router.navigate("/apps/burning");
    await screen.findByRole("heading", { level: 1, name: /burning/ });
    expect(screen.queryByText("Checks on our release branch")).toBeNull();
    await router.navigate("/signals");
    fireEvent.click(await screen.findByRole("button", { name: "Show everything again" }));
    await waitFor(() => expect(window.localStorage.getItem(storageKey("moneta"))).toBeNull());
  });

  it("offers a config change for everyone without writing anything", async () => {
    serve(files());
    renderRoute("/signals", META, tenant);
    const maintainers = await screen.findByRole("listitem", { name: "Maintainers" });
    expect(within(maintainers).getByText(/collect: false/).textContent).toBe("maintainers:\n  collect: false\n");
    expect(within(maintainers).getByText(/under the existing signals: key/)).toBeTruthy();
    const edit = within(maintainers).getByRole("link", { name: "Edit fleet.yaml on GitHub" });
    expect(edit.getAttribute("href")).toMatch(/\/edit\/main\/dashboard\/config\/moneta\/fleet\.yaml$/);
  });

  it("names what else turning a signal on needs", async () => {
    const off = structuredClone(MANIFEST_META);
    off.fleet.signals.promotion = { ...off.fleet.signals.promotion, collect: false, show: [] };
    serve(files(off));
    renderRoute("/signals", META, tenant);
    const promotion = await screen.findByRole("listitem", { name: "Promotion" });
    expect(within(promotion).getByText(/also needs branches.staging/)).toBeTruthy();
  });

  it("explains that the list appears after the next collection when data predates it", async () => {
    serve(files(null));
    renderRoute("/signals", META, tenant);
    expect(await screen.findByText(/published before signals were listed/)).toBeTruthy();
  });
});

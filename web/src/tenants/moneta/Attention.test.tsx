import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPENEDX_SITE_META, renderRoute } from "../../test/renderRoute";
import { monetaTenant } from "./index";
import { clearMonetaViews } from "./useMonetaViews";

const META = { ...OPENEDX_SITE_META, name: "Moneta FOSS Status", tagline: "Drift", freshness: undefined };
const metadata = { schema_version: 1, org: "moneta", generated_at: "2026-10-12T00:00:00Z" };

function fork(repo: string) {
  return {
    repo,
    class: "fork",
    url: `https://github.com/Org/${repo}`,
    description: null,
    licence: "MIT",
    upstream: `up/${repo}`,
    upstream_url: null,
    upstream_branch: "main",
    production_branch: "foss-main",
    purpose: null,
    what_we_changed: null,
    pushed_at: "2026-10-01T00:00:00Z",
    open_pull_requests: 0,
    latest_tag: null,
  };
}

function drift(repo: string, status: string, behind: number, advisories = 0) {
  return {
    repo,
    status,
    ahead_by: 1,
    behind_by: behind,
    last_upstream_merge: "2026-05-01T00:00:00Z",
    days_since_upstream_merge: 100,
    fork_release: { tag: "v1", date: null },
    upstream_release: null,
    advisories: { published: advisories, since_fork_release: advisories, source: "x" },
    promotion: null,
  };
}

function serve(drifts: unknown[], forks: string[]) {
  const files: Record<string, unknown> = {
    "apps.json": { metadata, records: forks.map(fork) },
    "drift.json": { metadata, records: drifts },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = files[url.split("/").pop() ?? ""];
      return new Response(JSON.stringify(body), { status: body ? 200 : 404, headers: { "Content-Type": "application/json" } });
    }),
  );
}

beforeEach(() => clearMonetaViews());
afterEach(() => vi.unstubAllGlobals());

describe("Needs attention page", () => {
  it("groups stale and critical forks, critical first, and leaves healthy ones out", async () => {
    serve([drift("calm", "in-sync", 0), drift("mid", "stale", 600), drift("burning", "critical", 3000, 2)], ["calm", "mid", "burning"]);
    renderRoute("/attention", META, monetaTenant);
    await screen.findByRole("heading", { name: "Critical (1)" });
    expect(screen.getByRole("heading", { name: "Stale (1)" })).toBeTruthy();
    expect(screen.queryByRole("article", { name: "calm" })).toBeNull();
    const burning = screen.getByRole("article", { name: "burning" });
    expect(within(burning).getByRole("link", { name: "burning" }).getAttribute("href")).toBe("/apps/burning");
    expect(within(burning).getByText("2 new upstream advisories since our latest release")).toBeTruthy();
    expect(screen.getByText("2 of 3 forks are stale or critical. Each card says why. Open one for the full picture.")).toBeTruthy();
  });

  it("says so when every fork is healthy", async () => {
    serve([drift("calm", "in-sync", 0)], ["calm"]);
    renderRoute("/attention", META, monetaTenant);
    expect(await screen.findByText("No fork is stale or critical.")).toBeTruthy();
  });

  it("explains a data failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    renderRoute("/attention", META, monetaTenant);
    await waitFor(() => expect(screen.getByText("The fork status data could not be loaded.")).toBeTruthy());
  });
});

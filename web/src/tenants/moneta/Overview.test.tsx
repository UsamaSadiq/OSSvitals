import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPENEDX_SITE_META, renderRoute } from "../../test/renderRoute";
import { monetaTenant } from "./index";
import { clearMonetaViews } from "./useMonetaViews";

const META = { ...OPENEDX_SITE_META, name: "Moneta FOSS Status", tagline: "Drift", freshness: undefined };

function record(repo: string, status: string, behind: number, advisories: number) {
  return {
    repo,
    status,
    ahead_by: 3,
    behind_by: behind,
    last_upstream_merge: "2026-09-01T00:00:00Z",
    days_since_upstream_merge: 20,
    fork_release: { tag: "v1.0.0", date: "2026-09-10T00:00:00Z" },
    upstream_release: { tag: "v2.0.0", date: null },
    advisories: { published: advisories, since_fork_release: advisories, source: "github-published-advisories" },
    promotion: null,
  };
}

function app(repo: string, kind: "fork" | "original") {
  return {
    repo,
    class: kind,
    url: `https://github.com/Org/${repo}`,
    description: "An original project",
    licence: "MIT",
    upstream: kind === "fork" ? `up/${repo}` : null,
    upstream_url: kind === "fork" ? `https://github.com/up/${repo}` : null,
    upstream_branch: kind === "fork" ? "main" : null,
    production_branch: kind === "fork" ? "foss-main" : null,
    purpose: null,
    what_we_changed: null,
    pushed_at: "2026-10-01T00:00:00Z",
    open_pull_requests: 1,
    latest_tag: null,
  };
}

const metadata = { schema_version: 1, org: "moneta", generated_at: "2026-10-12T00:00:00Z" };
const FILES: Record<string, unknown> = {
  "drift_history.json": {
    metadata,
    records: [
      { date: "2026-10-10", repo: "burning", status: "stale", behind_by: 800, ahead_by: 3, advisories_since_release: 0 },
      { date: "2026-10-11", repo: "burning", status: "critical", behind_by: 900, ahead_by: 3, advisories_since_release: 2 },
    ],
  },
  "updates.json": { metadata, records: [{ date: "2026-10-09", title: "Moved to a new release flow", url: "https://example.org/post", repo: "calm" }] },
  "apps.json": { metadata, records: [app("calm", "fork"), app("burning", "fork"), app("middling", "fork"), app("tool", "original")] },
  "drift.json": { metadata, records: [record("calm", "in-sync", 0, 0), record("burning", "critical", 900, 2), record("middling", "stale", 300, 0)] },
};

const ORIGINAL_DRIFT = FILES["drift.json"];

beforeEach(() => {
  FILES["drift.json"] = ORIGINAL_DRIFT;
  clearMonetaViews();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = FILES[url.split("/").pop() ?? ""];
      return new Response(JSON.stringify(body), { status: body ? 200 : 404, headers: { "Content-Type": "application/json" } });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("Moneta overview", () => {
  it("links every count to the apps page pre-filtered", async () => {
    renderRoute("/", META, monetaTenant);
    const critical = await screen.findByRole("link", { name: "Critical: 1" });
    expect(critical.getAttribute("href")).toBe("/apps?status=critical");
    expect(screen.getByRole("link", { name: "With new advisories: 1" }).getAttribute("href")).toBe("/apps?advisories=1");
    expect(screen.getByRole("link", { name: "No release yet: 0" }).getAttribute("href")).toBe("/apps?no_release=1");
    expect(screen.getByRole("link", { name: "Original projects: 1" }).getAttribute("href")).toBe("/apps#originals");
    expect(screen.getByRole("link", { name: "MIT: 3" }).getAttribute("href")).toBe("/apps?licence=MIT");
  });

  it("points to the needs-attention page instead of listing the forks", async () => {
    renderRoute("/", META, monetaTenant);
    const link = await screen.findByRole("link", { name: "2 forks need attention" });
    expect(link.getAttribute("href")).toBe("/attention");
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Needs attention" })).toBeNull();
  });

  it("shows status changes from the history and the org updates", async () => {
    renderRoute("/", META, monetaTenant);
    const changes = (await screen.findByRole("heading", { name: "Recent status changes" })).closest("section") as HTMLElement;
    expect(within(changes).getByRole("link", { name: "burning" }).getAttribute("href")).toBe("/apps/burning");
    expect(within(changes).getByText("Stale → Critical")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Moved to a new release flow" }).getAttribute("href")).toBe("https://example.org/post");
  });

  it("charts signals and licences as bordered bar charts too", async () => {
    renderRoute("/", META, monetaTenant);
    await screen.findByRole("navigation", { name: "Forks by status" });
    const signals = screen.getByRole("navigation", { name: "Release and advisory signals" });
    expect(within(signals).getAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual(["With new advisories: 1", "No release yet: 0", "Original projects: 1"]);
    const licences = screen.getByRole("navigation", { name: "Forks by licence" });
    expect(within(licences).getAllByRole("link")).toHaveLength(1);
  });

  it("charts every status as a column, including empty ones, each linking to its apps filter", async () => {
    renderRoute("/", META, monetaTenant);
    const chart = await screen.findByRole("navigation", { name: "Forks by status" });
    const columns = within(chart).getAllByRole("link").map((link) => [link.getAttribute("aria-label"), link.getAttribute("href")]);
    expect(columns).toEqual([
      ["In sync: 1", "/apps?status=in-sync"],
      ["Lagging: 0", "/apps?status=lagging"],
      ["Stale: 1", "/apps?status=stale"],
      ["Critical: 1", "/apps?status=critical"],
    ]);
  });

  it("shows the total in the heading and no per-status tiles", async () => {
    renderRoute("/", META, monetaTenant);
    expect(await screen.findByRole("heading", { name: "Status of our forks (3 tracked)" })).toBeTruthy();
    expect(screen.queryByText("Forks tracked")).toBeNull();
  });

  it("hides the not-yet-promoted tile when no fork has unpromoted commits", async () => {
    renderRoute("/", META, monetaTenant);
    await screen.findByRole("link", { name: /^No release yet/ });
    expect(screen.queryByRole("link", { name: /^Not yet promoted/ })).toBeNull();
  });

  it("shows the not-yet-promoted tile, linked to its filter, when a fork has unpromoted commits", async () => {
    const drift = FILES["drift.json"] as { metadata: unknown; records: Record<string, unknown>[] };
    FILES["drift.json"] = { ...drift, records: drift.records.map((entry) => (entry.repo === "burning" ? { ...entry, promotion: { unpromoted_commits: 4 } } : entry)) };
    renderRoute("/", META, monetaTenant);
    expect((await screen.findByRole("link", { name: "Not yet promoted: 1" })).getAttribute("href")).toBe("/apps?unpromoted=1");
  });

  it("explains a data failure instead of showing an empty page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    renderRoute("/", META, monetaTenant);
    await waitFor(() => expect(screen.getByText("The fork status data could not be loaded.")).toBeTruthy());
  });
});

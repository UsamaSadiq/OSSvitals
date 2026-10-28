import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
  "apps.json": { metadata, records: [app("calm", "fork"), app("burning", "fork"), app("tool", "original")] },
  "drift.json": { metadata, records: [record("calm", "in-sync", 0, 0), record("burning", "critical", 900, 2)] },
};

beforeEach(() => {
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

function filterChip(name: RegExp) {
  return screen.findByRole("button", { name });
}

describe("Moneta apps page", () => {
  it("shows one card per fork with the most drifted first", async () => {
    renderRoute("/apps", META, monetaTenant);
    const cards = await screen.findAllByRole("article");
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual(["burning", "calm"]);
  });

  it("keeps cards to the essentials and links each one to its detail page", async () => {
    renderRoute("/apps", META, monetaTenant);
    const burning = await screen.findByRole("article", { name: "burning" });
    expect(within(burning).getByRole("link", { name: "burning" }).getAttribute("href")).toBe("/apps/burning");
    expect(within(burning).getByText("2 new upstream advisories since our latest release")).toBeTruthy();
    expect(within(burning).getByText("MIT")).toBeTruthy();
    expect(within(burning).queryByText(/Ours /)).toBeNull();
    expect(within(burning).queryByText(/patches/)).toBeNull();
  });

  it("shows the advisory badge only on forks with new advisories", async () => {
    renderRoute("/apps", META, monetaTenant);
    const calm = await screen.findByRole("article", { name: "calm" });
    expect(within(calm).queryByText(/new upstream advisor/)).toBeNull();
  });

  it("offers status chips with counts instead of count tiles", async () => {
    renderRoute("/apps", META, monetaTenant);
    expect(await filterChip(/^Critical \(1\)$/)).toBeTruthy();
    expect(await filterChip(/^In sync \(1\)$/)).toBeTruthy();
    expect(screen.getByText("2 of 2 forks")).toBeTruthy();
  });

  it("filters both tabs by status and can clear the filter", async () => {
    renderRoute("/apps", META, monetaTenant);
    fireEvent.click(await filterChip(/^Critical/));
    await waitFor(() => expect(screen.queryByRole("article", { name: "calm" })).toBeNull());
    expect(screen.getByText(/^1 of 2 forks/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    const forks = await screen.findByRole("table", { name: /Forks and how far/ });
    expect(within(forks).queryByText("calm")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(within(screen.getByRole("table", { name: /Forks and how far/ })).getByText("calm")).toBeTruthy());
  });

  it("offers the filtered table as a CSV download", async () => {
    renderRoute("/apps", META, monetaTenant);
    await screen.findAllByRole("article");
    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    expect(await screen.findByRole("button", { name: "Download CSV" })).toBeTruthy();
  });

  it("says so when no fork matches", async () => {
    renderRoute("/apps?app=zzz", META, monetaTenant);
    expect(await screen.findByText("No forks match these filters.")).toBeTruthy();
  });

  it("lists the same forks in the table tab and the originals separately", async () => {
    renderRoute("/apps", META, monetaTenant);
    await screen.findAllByRole("article");
    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    const forks = await screen.findByRole("table", { name: /Forks and how far/ });
    const originals = await screen.findByRole("table", { name: /Original projects/ });
    expect(within(forks).getByRole("link", { name: "burning" }).getAttribute("href")).toBe("/apps/burning");
    expect(within(originals).getByText("tool")).toBeTruthy();
  });

  it("names the forks whose collection failed instead of dropping them silently", async () => {
    const files: Record<string, unknown> = {
      "apps.json": { metadata, records: [app("calm", "fork"), app("broken", "fork"), app("tool", "original")] },
      "drift.json": { metadata, records: [record("calm", "in-sync", 0, 0), { repo: "broken", error: "cannot compare v2 with foss-main" }] },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const body = files[url.split("/").pop() ?? ""];
        return new Response(JSON.stringify(body), { status: body ? 200 : 404, headers: { "Content-Type": "application/json" } });
      }),
    );
    renderRoute("/apps", META, monetaTenant);
    expect(await screen.findByText("Collection failed for 1 fork: broken.")).toBeTruthy();
    expect(screen.getByText("1 of 1 forks")).toBeTruthy();
    expect(screen.queryByRole("article", { name: "broken" })).toBeNull();
  });

  it("explains a data failure instead of showing an empty page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    renderRoute("/apps", META, monetaTenant);
    await waitFor(() => expect(screen.getByText("The fork status data could not be loaded.")).toBeTruthy());
  });
});

describe("Moneta app detail", () => {
  it("shows every fact for a fork", async () => {
    renderRoute("/apps/burning", { ...META, githubOrg: "Org" }, monetaTenant);
    expect(await screen.findByRole("heading", { level: 1, name: /burning/ })).toBeTruthy();
    for (const term of ["Behind upstream", "Our patches", "Last upstream sync", "Our latest release", "Upstream latest release", "Upstream advisories", "Not yet promoted", "Licence"]) {
      expect(screen.getByText(term)).toBeTruthy();
    }
    expect(screen.getByText("900 commits")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Compare our branch with upstream" }).getAttribute("href")).toBe(
      "https://github.com/Org/burning/compare/up:main...foss-main",
    );
  });

  it("links back to the apps page", async () => {
    renderRoute("/apps/burning", META, monetaTenant);
    const back = await screen.findByRole("link", { name: "← All apps" });
    expect(back.getAttribute("href")).toBe("/apps");
  });

  it("is not found for an unknown app or an original", async () => {
    renderRoute("/apps/nope", META, monetaTenant);
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
  });
});

describe("Moneta apps page app filter", () => {
  it("offers an app dropdown next to the licence dropdown and filters to the chosen app", async () => {
    renderRoute("/apps", META, monetaTenant);
    await screen.findAllByRole("article");
    expect(screen.queryByRole("searchbox")).toBeNull();
    fireEvent.change(screen.getByLabelText("App"), { target: { value: "calm" } });
    await waitFor(() => expect(screen.queryByRole("article", { name: "burning" })).toBeNull());
    expect(screen.getByRole("article", { name: "calm" })).toBeTruthy();
    expect(screen.getByLabelText("Licence")).toBeTruthy();
  });
});

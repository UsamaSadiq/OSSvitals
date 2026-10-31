import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantProvider } from "../../tenants/context";
import { fleetTenant } from "./index";
import { FleetPaletteHost } from "./PaletteHost";
import { clearFleetViews } from "./useFleetViews";

const metadata = { schema_version: 1, org: "moneta", generated_at: "2026-10-12T00:00:00Z" };
const APP = {
  repo: "burning",
  class: "fork",
  url: "",
  description: null,
  licence: null,
  upstream: "up/burning",
  upstream_url: null,
  upstream_branch: "main",
  production_branch: "foss-main",
  purpose: null,
  what_we_changed: null,
  pushed_at: "",
  open_pull_requests: 0,
  latest_tag: null,
};
const DRIFT = {
  repo: "burning",
  status: "critical",
  ahead_by: 1,
  behind_by: 2,
  last_upstream_merge: "",
  days_since_upstream_merge: 1,
  fork_release: null,
  upstream_release: null,
  advisories: { published: 0, since_fork_release: 0, source: "x" },
  promotion: null,
};

function serve(files: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = files[url.split("/").pop() ?? ""];
      return new Response(JSON.stringify(body), {
        status: body ? 200 : 404,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

beforeEach(() => clearFleetViews());
afterEach(() => vi.unstubAllGlobals());

describe("FleetPaletteHost", () => {
  it("offers every fork as a searchable app once the data has loaded", async () => {
    serve({ "apps.json": { metadata, records: [APP] }, "drift.json": { metadata, records: [DRIFT] } });
    const seen: string[] = [];
    render(
      <MemoryRouter>
        <TenantProvider tenant={fleetTenant("moneta")}>
          <FleetPaletteHost pages={[{ path: "/", title: "Overview" }]} maintainerViews={false}>
            {(index) => {
              seen.push(`${index.loading}:${index.items.apps?.map((item) => `${item.label}>${item.to}`).join(",")}`);
              return <p>{index.items.pages?.length} page</p>;
            }}
          </FleetPaletteHost>
        </TenantProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(seen.at(-1)).toBe("false:burning>/apps/burning"));
    expect(screen.getByText("1 page")).toBeTruthy();
  });

  it("marks apps unavailable when the data cannot load", async () => {
    serve({});
    let unavailable: string[] = [];
    render(
      <MemoryRouter>
        <TenantProvider tenant={fleetTenant("moneta")}>
          <FleetPaletteHost pages={[]} maintainerViews={false}>
            {(index) => {
              unavailable = index.unavailable;
              return null;
            }}
          </FleetPaletteHost>
        </TenantProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(unavailable).toEqual(["apps"]));
  });
});

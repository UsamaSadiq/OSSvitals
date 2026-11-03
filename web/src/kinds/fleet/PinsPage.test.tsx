import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPENEDX_SITE_META, renderRoute } from "../../test/renderRoute";
import { fleetTenant } from "./index";
import { compareUrl, releaseUrl, repoFullName } from "./paths";
import { distanceText } from "./PinsPage";
import type { PinRecord } from "./schemas";
import { clearFleetViews } from "./useFleetViews";

const tenant = fleetTenant("edly");
const META = { ...OPENEDX_SITE_META, name: "Edly", tagline: "Pins", freshness: undefined };
const metadata = { schema_version: 1, org: "edly", generated_at: "2026-11-01T00:00:00Z" };

function pin(overrides: Partial<PinRecord>): PinRecord {
  return {
    repo: "edx-platform",
    full_name: "edly-io/edx-platform",
    class: "fork",
    pin: "edly-21.0.1",
    pin_kind: "tag",
    pin_note: null,
    latest_release: "edly-21.0.3",
    releases_behind: 2,
    commits_behind: 40,
    status: "behind",
    ...overrides,
  };
}

const PINS = [
  pin({}),
  pin({ repo: "tutor", full_name: "overhangio/tutor", class: "dependency", pin: "v21.0.0", latest_release: "v21.0.0", releases_behind: 0, commits_behind: 0, status: "current" }),
  { repo: "broken", error: "not found" },
];

let files: Record<string, unknown>;

beforeEach(() => {
  clearFleetViews();
  files = {
    "apps.json": { metadata, records: [] },
    "drift.json": { metadata, records: [] },
    "pins.json": { metadata, records: PINS },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = files[url.split("/").pop() ?? ""];
      return new Response(JSON.stringify(body), { status: body ? 200 : 404, headers: { "Content-Type": "application/json" } });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("Pins page", () => {
  it("lists each pin with how far it is behind, links forks to their page and third-party repos to GitHub", async () => {
    renderRoute("/pins", META, tenant);
    const fork = (await screen.findByRole("link", { name: "edx-platform" })).closest("tr") as HTMLElement;
    expect(within(fork).getByText("2 releases behind edly-21.0.3")).toBeTruthy();
    expect(within(fork).getByText("Behind")).toBeTruthy();
    expect(screen.getByRole("link", { name: "edx-platform" }).getAttribute("href")).toBe("/apps/edx-platform");
    const dependency = screen.getByRole("link", { name: "overhangio/tutor" });
    expect(dependency.getAttribute("href")).toBe("https://github.com/overhangio/tutor");
    expect(within(dependency.closest("tr") as HTMLElement).getByText("Third-party")).toBeTruthy();
    expect(screen.getByText(/broken/)).toBeTruthy();
  });

  it("says so when the tenant pins nothing", async () => {
    delete files["pins.json"];
    renderRoute("/pins", META, tenant);
    expect(await screen.findByText("No app has a production pin yet.")).toBeTruthy();
  });
});

describe("distanceText", () => {
  it("counts releases first, then commits", () => {
    expect(distanceText(pin({ releases_behind: 1 }))).toBe("1 release behind edly-21.0.3");
    expect(distanceText(pin({ pin_kind: "branch", releases_behind: null, commits_behind: 3 }))).toBe("3 commits behind edly-21.0.3");
    expect(distanceText(pin({ releases_behind: 0, commits_behind: 0 }))).toBe("At edly-21.0.3");
    expect(distanceText(pin({ latest_release: null, releases_behind: null, commits_behind: null }))).toBe("No release found");
  });
});

describe("repo links", () => {
  it("use the app's own owner when it has one", () => {
    expect(repoFullName({ repo: "journal_xblock", full_name: "PakistanX/journal_xblock" }, "edly-io")).toBe("PakistanX/journal_xblock");
    expect(repoFullName({ repo: "x" }, "edly-io")).toBe("edly-io/x");
    expect(repoFullName({ repo: "x" }, undefined)).toBeUndefined();
    expect(compareUrl("PakistanX/a", "up/a", "main", "develop-ulmo")).toBe("https://github.com/PakistanX/a/compare/up:main...develop-ulmo");
    expect(releaseUrl("edly-io/a", "edly-21.0.1")).toBe("https://github.com/edly-io/a/tree/edly-21.0.1");
  });
});

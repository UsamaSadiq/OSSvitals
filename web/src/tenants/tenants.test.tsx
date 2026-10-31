import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { isPageVisible, visibleSections } from "../pages/catalog";
import { OPENEDX_SITE_META, renderRoute } from "../test/renderRoute";
import { fleetTenant } from "../kinds/fleet";
import { openedxTenant } from "./openedx";
import { buildRegistry, tenantFor } from "./registry";

const requested = vi.hoisted(() => [] as string[]);

vi.mock("../data/useView", () => ({
  useView: (name: string) => {
    requested.push(name);
    return { status: "loading", data: undefined, error: undefined };
  },
}));

describe("tenant registry", () => {
  it("returns the matching tenant and falls back to openedx for unknown orgs", () => {
    expect(tenantFor("moneta")).toMatchObject({ org: "moneta", paletteCopy: fleetTenant("moneta").paletteCopy });
    expect(tenantFor("openedx")).toBe(openedxTenant);
    expect(tenantFor("someone-else")).toBe(openedxTenant);
  });

  it("serves a new fleet org from the index alone, with no code of its own", () => {
    const lookup = buildRegistry({ acme: { kind: "fleet", site: "https://acme.ossvitals.org" } });
    expect(lookup("acme")).toMatchObject({ org: "acme", paletteCopy: fleetTenant("acme").paletteCopy });
    expect(lookup("acme")).toBe(lookup("acme"));
  });
});

describe("page manifest", () => {
  const page = { path: "/repos", title: "Repositories" };

  it("shows every page when no manifest is given", () => {
    expect(isPageVisible(page, { maintainerViews: true })).toBe(true);
  });

  it("hides pages that the manifest does not list, and drops empty sections", () => {
    const sections = [
      { title: "A", pages: [page] },
      { title: "B", pages: [{ path: "/x", title: "X" }] },
    ];
    expect(visibleSections(sections, { maintainerViews: true, manifest: ["/x"] })).toEqual([sections[1]]);
  });
});

describe("a tenant with only meta.json", () => {
  it("renders its own nav and requests no openedx view", async () => {
    requested.length = 0;
    renderRoute("/", { ...OPENEDX_SITE_META, name: "Moneta Status", tagline: "Fork health" }, fleetTenant("moneta"));

    expect(await screen.findByRole("heading", { level: 1, name: "Moneta Status" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Pages" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Overview", "Apps", "Needs attention", "Signals"]);
    expect(requested.filter((name) => name !== "meta")).toEqual([]);
  });
});

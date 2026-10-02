import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoute, withMaintainerViews } from "../test/renderRoute";
import { DEFAULT_LEGACY_URL, legacyBaseUrl, legacyPageUrl } from "./legacyUrl";

describe("legacy URL", () => {
  it("defaults to the Streamlit app", () => {
    expect(legacyBaseUrl(undefined)).toBe(DEFAULT_LEGACY_URL);
    expect(legacyBaseUrl("  ")).toBe(DEFAULT_LEGACY_URL);
  });

  it("drops a trailing slash from a configured base", () => {
    expect(legacyBaseUrl("https://example.org/")).toBe("https://example.org");
  });

  it("appends path and query", () => {
    expect(legacyPageUrl("https://example.org", "/at_risk", "?tier=1")).toBe("https://example.org/at_risk?tier=1");
  });
});

describe("Placeholder", () => {
  it("links to the same path and query on the legacy dashboard", async () => {
    renderRoute("/repo_detail?repo=openedx%2Fedx-platform");

    const link = await screen.findByRole("link", { name: /open repo detail on the current dashboard/i });
    expect(link).toHaveAttribute("href", `${DEFAULT_LEGACY_URL}/repo_detail?repo=openedx%2Fedx-platform`);
    expect(screen.getByRole("heading", { level: 1, name: "Repo Detail" })).toBeInTheDocument();
  });

  it("sets the page title", async () => {
    renderRoute("/scoring");
    await screen.findByRole("heading", { level: 1, name: "How Scoring Works" });
    expect(document.title).toBe("How Scoring Works · Open edX Repo Health");
  });
});

describe("NotFound", () => {
  it("renders a 404 page with a link home", async () => {
    renderRoute("/no/such/page");

    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the Overview" })).toHaveAttribute("href", "/");
    expect(document.title).toBe("Page not found · Open edX Repo Health");
  });
});

describe("maintainer-only pages", () => {
  it("render when maintainer views are enabled", async () => {
    renderRoute("/at_risk", withMaintainerViews(true));
    expect(await screen.findByRole("heading", { level: 1, name: "At Risk" })).toBeInTheDocument();
  });

  it("/ownership_views is not found when maintainer views are disabled", async () => {
    renderRoute("/ownership_views", withMaintainerViews(false));
    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
  });
});

describe("Overview route", () => {
  it("renders at the root", async () => {
    renderRoute("/");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Open edX Repository Health Dashboard" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Overview · Open edX Repo Health");
  });
});

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoute, withMaintainerViews } from "../test/renderRoute";

describe("page routes", () => {
  it("serves every navigation page from its ported component", async () => {
    renderRoute("/repo_detail?repo=openedx%2Fedx-platform");
    expect(await screen.findByRole("heading", { level: 1, name: "Repository Detail" })).toBeInTheDocument();
    expect(document.title).toBe("Repo Detail · Open edX Repo Health");
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

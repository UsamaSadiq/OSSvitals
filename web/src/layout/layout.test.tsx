import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderRoute, withMaintainerViews } from "../test/renderRoute";
import { footerLinks } from "./Footer";
import { shouldNoindex } from "./noindex";
import { DEFAULT_SITE_META } from "./siteMeta";

function navLinkNames(): string[] {
  const nav = screen.getByRole("navigation", { name: "Pages" });
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.textContent ?? "");
}

describe("Nav", () => {
  it("lists every page in Streamlit order when maintainer views are on", async () => {
    renderRoute("/", withMaintainerViews(true));
    await screen.findByRole("navigation", { name: "Pages" });

    expect(navLinkNames()).toEqual([
      "Overview",
      "Repo Detail",
      "Failing Checks",
      "What Changed",
      "Needing Attention",
      "At Risk",
      "Owners",
      "Upgrades",
      "Components",
      "Checks Catalog",
      "How Scoring Works",
    ]);
  });

  it("hides the maintainer pages when the flag is off", async () => {
    renderRoute("/", withMaintainerViews(false));
    await screen.findByRole("navigation", { name: "Pages" });

    expect(navLinkNames()).not.toContain("At Risk");
    expect(navLinkNames()).not.toContain("Owners");
    expect(navLinkNames()).toContain("Upgrades");
  });

  it("does not serve maintainer routes when the flag is off", async () => {
    renderRoute("/at_risk", withMaintainerViews(false));
    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
  });
});

describe("Shell", () => {
  it("renders landmarks and a skip link", async () => {
    renderRoute("/");
    await screen.findByRole("main");

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
  });

  it("closes the menu and moves focus to the main content after navigating", async () => {
    renderRoute("/");
    const menu = await screen.findByRole("button", { name: "Menu" });
    await userEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(screen.getByRole("link", { name: "Checks Catalog" }));

    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("main")).toHaveFocus();
  });
});

describe("Footer", () => {
  it("renders source, privacy and the notice", async () => {
    renderRoute("/");
    const footer = await screen.findByRole("contentinfo");

    expect(within(footer).getByRole("link", { name: "Source code" })).toHaveAttribute(
      "href",
      DEFAULT_SITE_META.footer.sourceUrl,
    );
    expect(within(footer).getByRole("link", { name: "Privacy" })).toBeInTheDocument();
    expect(within(footer).getByText(/not affiliated with Axim Collaborative/)).toBeInTheDocument();
  });

  it("skips links without a URL", () => {
    expect(footerLinks({ privacyUrl: "https://example.org/privacy" })).toEqual([
      { label: "Privacy", url: "https://example.org/privacy" },
    ]);
  });
});

describe("shouldNoindex", () => {
  it("is true only for next. hostnames", () => {
    expect(shouldNoindex("next.ossvitals.org")).toBe(true);
    expect(shouldNoindex("openedx.ossvitals.org")).toBe(false);
    expect(shouldNoindex("localhost")).toBe(false);
  });
});

describe("meta.json load error", () => {
  it("names the file inside the shell instead of a blank page", async () => {
    renderRoute("/", { ...DEFAULT_SITE_META, loadError: "meta.json: HTTP 404 from /data/openedx/views/meta.json" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("meta.json: HTTP 404");
    expect(screen.getByRole("navigation", { name: "Pages" })).toBeInTheDocument();
  });
});

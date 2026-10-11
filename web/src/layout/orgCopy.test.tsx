import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { metaFixture } from "../data/fixtures";
import { toSiteMeta } from "../data/siteMeta";
import { atRiskCaption } from "../pages/AtRisk/atRiskText";
import { Independence } from "../pages/Scoring/Independence";
import { Intro } from "../pages/Scoring/MethodSections";
import { membershipNote, missingFileNote } from "./catalogCopy";
import { formatPageTitle } from "./pageTitle";
import { DEFAULT_SITE_META, SiteMetaProvider } from "./siteMeta";

function bareMeta() {
  const base = metaFixture();
  return toSiteMeta({
    ...base,
    github_org: undefined,
    unmaintained_group: null,
    branding: { name: "Acme Health", short_name: "Acme", tagline: "t" },
  });
}

describe("org copy without configuration", () => {
  it("falls back to the short name for the page title", () => {
    expect(bareMeta().title).toBe("Acme");
    expect(formatPageTitle("Overview", bareMeta().title)).toBe("Overview · Acme");
  });

  it("leaves provenance and catalog empty so pages can render neutral text", () => {
    const site = bareMeta();
    expect(site.provenance.checksName).toBeUndefined();
    expect(site.catalog.name).toBeUndefined();
    expect(site.scoresFileUrl).toBeUndefined();
  });

  it("writes catalog notes without naming any catalog", () => {
    expect(membershipNote({})).toBe(
      "User owners are checked against GitHub; group owners are not, since that needs organization membership.",
    );
    expect(missingFileNote({})).toBe("The catalog does not list it and its owner is unknown.");
    expect(missingFileNote({ name: "Backstage", specName: "OEP-55" })).toBe(
      "Backstage does not list it and its owner is unknown. OEP-55 describes the file.",
    );
  });

  it("omits the unmaintained group from the at-risk caption when none is configured", () => {
    expect(atRiskCaption(undefined)).toMatch(/^Repositories waiting for a maintainer, owned by a single person/);
    expect(atRiskCaption("acme-unowned")).toMatch(/waiting for a maintainer \(`acme-unowned`\), owned by/);
  });

  it("renders the scoring text with no openedx wording on the default meta", () => {
    render(
      <SiteMetaProvider value={DEFAULT_SITE_META}>
        <Intro version="1.0" />
        <Independence />
      </SiteMetaProvider>,
    );
    expect(screen.getByText(/the repository health checks/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/openedx|Open edX|edx-repo-health/i);
  });
});

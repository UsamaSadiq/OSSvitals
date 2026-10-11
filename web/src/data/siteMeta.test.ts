import { describe, expect, it } from "vitest";
import { metaFixture } from "./fixtures";
import { toSiteMeta } from "./siteMeta";

describe("toSiteMeta", () => {
  it("fills branding, footer, flags and freshness from meta.json", () => {
    const site = toSiteMeta(metaFixture(), new Date("2026-10-02T12:00:00Z"));

    expect(site).toEqual({
      name: "Open edX Repository Health Dashboard",
      shortName: "Open edX Health",
      tagline: "Visualization-first health insights for Open edX repositories",
      title: "Open edX Repo Health",
      githubOrg: "openedx",
      unmaintainedGroup: "openedx-unmaintained",
      scoresFileUrl: "https://github.com/UsamaSadiq/OSSvitals/blob/data/openedx/scores.json",
      provenance: {
        checksName: "Open edX repo health",
        checksRepoLabel: "edx-repo-health",
        checksRepoUrl: "https://github.com/openedx/edx-repo-health",
        dataRepoLabel: "openedx/wg-maintenance",
        dataRepoUrl: "https://github.com/openedx/wg-maintenance/tree/main/dashboards",
        governanceBody: "the Open edX Maintenance Working Group",
      },
      catalog: {
        name: "Backstage",
        browseUrl: "https://backstage.openedx.org/catalog",
        membershipScope: "openedx org membership",
        specName: "OEP-55",
        specUrl: "https://open-edx-proposals.readthedocs.io/en/latest/processes/oep-0055-proc-project-maintainers.html",
      },
      footer: {
        sourceUrl: "https://github.com/UsamaSadiq/OSSvitals",
        privacyUrl: "https://github.com/UsamaSadiq/OSSvitals/blob/main/docs/PRIVACY.md",
        notice: "Unofficial community project, not affiliated with Axim Collaborative. Open edX is a registered trademark of Axim Collaborative.",
      },
      featureFlags: { enableMaintainerViews: false, enableWeeklyBulletinExport: true, enableMyReposFilter: true, enablePrTemplateGenerator: true },
      freshness: { level: "fresh" },
      snapshotDate: "2026-10-02",
    });
  });
});

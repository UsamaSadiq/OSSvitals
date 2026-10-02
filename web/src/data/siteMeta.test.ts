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
      footer: {
        sourceUrl: "https://github.com/UsamaSadiq/OSSvitals",
        privacyUrl: "https://github.com/UsamaSadiq/OSSvitals/blob/main/docs/PRIVACY.md",
        notice: "Unofficial community project.",
      },
      featureFlags: { enableMaintainerViews: false },
      freshness: { level: "fresh" },
    });
  });
});

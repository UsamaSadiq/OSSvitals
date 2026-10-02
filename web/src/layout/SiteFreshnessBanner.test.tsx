import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFreshnessBanner } from "./SiteFreshnessBanner";
import { DEFAULT_SITE_META, SiteMetaProvider } from "./siteMeta";

describe("SiteFreshnessBanner", () => {
  it("renders nothing before meta.json has loaded", () => {
    const { container } = render(<SiteFreshnessBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the level computed from meta.json", () => {
    const meta = {
      ...DEFAULT_SITE_META,
      freshness: { level: "stale", ageHours: 72, snapshotDate: "2026-09-29", staleThresholdHours: 48 } as const,
    };
    render(
      <SiteMetaProvider value={meta}>
        <SiteFreshnessBanner />
      </SiteMetaProvider>,
    );
    expect(screen.getByText("This data is 3 days old.")).toBeInTheDocument();
  });
});

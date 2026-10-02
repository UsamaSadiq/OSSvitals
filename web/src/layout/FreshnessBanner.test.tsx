import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FreshnessBanner } from "./FreshnessBanner";

describe("FreshnessBanner", () => {
  it("renders nothing for fresh data", () => {
    const { container } = render(<FreshnessBanner level="fresh" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("reports stale data with the threshold", () => {
    render(<FreshnessBanner level="stale" ageHours={30} snapshotDate="2026-10-01" staleThresholdHours={26} />);
    expect(screen.getByText("This data is 30h old.")).toBeInTheDocument();
    expect(screen.getByText(/past the 26h freshness threshold/)).toBeInTheDocument();
  });

  it("reports critically stale data as an alert", () => {
    render(<FreshnessBanner level="critical" ageHours={96} snapshotDate="2026-09-28" staleThresholdHours={26} />);
    expect(screen.getByRole("alert")).toHaveTextContent("This data is 4 days old.");
  });
});

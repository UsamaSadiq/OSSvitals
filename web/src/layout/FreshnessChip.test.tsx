import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoute } from "../test/renderRoute";
import { freshnessChip } from "./FreshnessChip";
import { DEFAULT_SITE_META } from "./siteMeta";

describe("freshnessChip", () => {
  it("names the snapshot date and the cadence when fresh", () => {
    expect(freshnessChip({ level: "fresh" }, "2026-10-03")).toEqual({
      tone: "fresh",
      label: "Data 2026-10-03",
      detail: "updated daily",
      title: "Snapshot 2026-10-03 (UTC), updated daily",
    });
  });

  it("says how old stale data is in the warn tone", () => {
    const chip = freshnessChip(
      { level: "stale", ageHours: 72, snapshotDate: "2026-10-01", staleThresholdHours: 48 },
      "2026-10-01",
    );
    expect(chip).toMatchObject({ tone: "warn", label: "Data 2026-10-01", detail: "3 days old" });
  });

  it("uses the fail tone for critically stale and unknown data", () => {
    const critical = { level: "critical", ageHours: 240, snapshotDate: "2026-09-24", staleThresholdHours: 48 } as const;
    expect(freshnessChip(critical, "2026-09-24").tone).toBe("fail");
    expect(freshnessChip({ level: "unknown" }, undefined)).toMatchObject({ tone: "fail", label: "Data date unknown" });
  });
});

describe("FreshnessChip in the header", () => {
  it("shows the snapshot date once site meta has loaded", async () => {
    renderRoute("/", { ...DEFAULT_SITE_META, freshness: { level: "fresh" }, snapshotDate: "2026-10-03" });
    const header = await screen.findByRole("banner");
    expect(within(header).getByText("Data 2026-10-03")).toBeInTheDocument();
    expect(within(header).getByText("Data 2026-10-03").closest(".freshness-chip")).toHaveClass("freshness-chip--fresh");
  });

  it("renders nothing before site meta has loaded", async () => {
    renderRoute("/");
    const header = await screen.findByRole("banner");
    expect(within(header).queryByText(/^Data /)).not.toBeInTheDocument();
  });

  it("marks stale data in the warn tone", async () => {
    const freshness = { level: "stale", ageHours: 72, snapshotDate: "2026-10-01", staleThresholdHours: 48 } as const;
    renderRoute("/", { ...DEFAULT_SITE_META, freshness, snapshotDate: "2026-10-01" });
    const header = await screen.findByRole("banner");
    expect(within(header).getByText("· 3 days old").closest(".freshness-chip")).toHaveClass("freshness-chip--warn");
  });
});

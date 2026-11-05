import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KpiTile } from "./KpiTile";
import { Badge } from "./Badge";

describe("KpiTile tone", () => {
  it("marks a toned tile and leaves an untoned one plain", () => {
    render(
      <>
        <KpiTile label="Job failing" value="45" tone="fail" />
        <KpiTile label="Healthy" value="27" />
      </>,
    );

    expect(screen.getByRole("group", { name: "Job failing" })).toHaveClass("kpi-tile", "kpi-tile--fail");
    expect(screen.getByRole("group", { name: "Healthy" })).toHaveAttribute("class", "kpi-tile");
  });
});

describe("Badge", () => {
  it("renders a status label with its tone, neutral by default", () => {
    render(
      <>
        <Badge tone="warn">Calendar out of date</Badge>
        <Badge>Could not check</Badge>
      </>,
    );

    expect(screen.getByText("Calendar out of date")).toHaveClass("badge", "badge--warn");
    expect(screen.getByText("Could not check")).toHaveClass("badge--neutral");
  });
});

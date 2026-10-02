import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import type { ChartSpec } from "./chartSpec";
import PlotFigureImpl from "./PlotFigureImpl";

const SPEC: ChartSpec = {
  options: { height: 100, x: { axis: null }, y: { axis: null } },
  marks: [{ type: "barY", data: [{ k: "a", v: 1 }], options: { x: "k", y: "v" } }],
};

describe("PlotFigure", () => {
  it("renders one figure under StrictMode and removes it on unmount", async () => {
    const { container, unmount } = render(
      <StrictMode>
        <PlotFigureImpl spec={SPEC} ariaLabel="Test chart" />
      </StrictMode>,
    );
    await waitFor(() => expect(container.querySelectorAll("svg")).toHaveLength(1));
    expect(container.querySelector("svg")).toHaveAttribute("aria-label", "Test chart");

    const host = container.querySelector(".plot-figure");
    unmount();
    expect(host?.childElementCount ?? 0).toBe(0);
  });
});

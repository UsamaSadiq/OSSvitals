import { describe, expect, it, vi } from "vitest";
import { labelAxis, labelEms, resolveSpec, type ChartSpec } from "./chartSpec";
import { topFailingChart } from "./charts";
import { renderPlot } from "./renderPlot";

const SPEC: ChartSpec = {
  options: { marginLeft: 240, marginRight: 96, height: 100 },
  narrow: { below: 560, marginLeft: 132, marginRight: 84 },
  marks: [{ type: "barX", data: [], options: {} }, labelAxis(240)],
};

describe("resolveSpec", () => {
  it("keeps the spec as built at or above the narrow breakpoint", () => {
    expect(resolveSpec(SPEC, 560)).toBe(SPEC);
    expect(resolveSpec({ ...SPEC, narrow: undefined }, 320).options.marginLeft).toBe(240);
  });

  it("narrows the margins and the label width on phones", () => {
    const resolved = resolveSpec(SPEC, 358);
    expect(resolved.options).toMatchObject({ marginLeft: 132, marginRight: 84, height: 100 });
    expect(resolved.marks[1]).toMatchObject({ type: "axisY", options: { lineWidth: labelEms(132), fontSize: 12 } });
    expect(SPEC.options.marginLeft).toBe(240);
  });

  it("wraps instead of truncating when asked", () => {
    expect(labelAxis(120, "wrap")).toEqual({
      type: "axisY",
      options: { label: null, tickSize: 0, fontSize: 12, lineWidth: 9 },
    });
  });
});

describe("renderPlot", () => {
  const rows = [
    { check: "makefile.test-js", failing: 5 },
    { check: "exists.transifex_config", failing: 2 },
  ];

  it("hides the drawn marks, tooltip and label axis from assistive tech", () => {
    const svg = renderPlot(topFailingChart(rows).spec, 640, "Checks");
    const tip = svg.querySelector("g[aria-label='tip']");
    expect(tip).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelector("g[aria-label='y-axis tick label']")).toHaveAttribute("aria-hidden", "true");
    expect(svg.getAttribute("aria-label")).toBe("Checks");
  });

  it("calls the link handler with the clicked row's target", () => {
    const onLink = vi.fn();
    const svg = renderPlot(topFailingChart(rows).spec, 640, "Checks", onLink);
    const rects = svg.querySelectorAll(".plot-link > rect");
    expect(rects).toHaveLength(2);
    rects[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onLink).toHaveBeenCalledWith("/failing_checks?category=exists.transifex_config");
  });

  it("draws no pointer affordance without a handler", () => {
    const svg = renderPlot(topFailingChart(rows).spec, 640, "Checks");
    expect(svg.querySelector(".plot-link")).toBeNull();
  });
});

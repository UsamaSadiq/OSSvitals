import * as Plot from "@observablehq/plot";
import type { ChartSpec, MarkSpec } from "./chartSpec";

const TRANSPARENT_STYLE = { background: "transparent", overflow: "visible" };

function toMark(spec: MarkSpec): Plot.Markish {
  switch (spec.type) {
    case "barX":
      return Plot.barX(spec.data, spec.options);
    case "barY":
      return Plot.barY(spec.data, spec.options);
    case "dot":
      return Plot.dot(spec.data, spec.options);
    case "lineY":
      return Plot.lineY(spec.data, spec.options);
    case "ruleY":
      return Plot.ruleY(spec.data, spec.options);
    case "text":
      return Plot.text(spec.data, spec.options);
  }
}

export function renderPlot(spec: ChartSpec, width: number, ariaLabel: string): SVGSVGElement | HTMLElement {
  return Plot.plot({
    style: TRANSPARENT_STYLE,
    ...spec.options,
    width,
    ariaLabel,
    marks: spec.marks.map(toMark),
  });
}

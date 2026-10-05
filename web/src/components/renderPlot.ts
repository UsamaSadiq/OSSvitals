import * as Plot from "@observablehq/plot";
import type { ChartSpec, MarkSpec } from "./chartSpec";

const CHART_STYLE = {
  background: "transparent",
  overflow: "visible",
  fontSize: "12px",
  fontFamily: "inherit",
  fontVariantNumeric: "tabular-nums",
};

// The figure carries its own text alternative; Plot's per-mark aria-labels sit on role-less <g> elements.
const HIDDEN = "true";

function toMark(spec: MarkSpec): Plot.Markish {
  switch (spec.type) {
    case "barX":
      return Plot.barX(spec.data, { ...spec.options, ariaHidden: HIDDEN });
    case "barY":
      return Plot.barY(spec.data, { ...spec.options, ariaHidden: HIDDEN });
    case "dot":
      return Plot.dot(spec.data, { ...spec.options, ariaHidden: HIDDEN });
    case "lineY":
      return Plot.lineY(spec.data, { ...spec.options, ariaHidden: HIDDEN });
    case "ruleY":
      return Plot.ruleY(spec.data, { ...spec.options, ariaHidden: HIDDEN });
    case "text":
      return Plot.text(spec.data, { ...spec.options, ariaHidden: HIDDEN });
  }
}

export function renderPlot(spec: ChartSpec, width: number, ariaLabel: string): SVGSVGElement | HTMLElement {
  return Plot.plot({
    style: CHART_STYLE,
    ...spec.options,
    width,
    ariaLabel,
    marks: spec.marks.map(toMark),
  });
}

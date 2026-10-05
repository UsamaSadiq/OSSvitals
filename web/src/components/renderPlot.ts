import * as Plot from "@observablehq/plot";
import { resolveSpec, type ChartSpec, type MarkSpec, type PointerAxis, type TipMarkOptions } from "./chartSpec";

export type LinkHandler = (to: string) => void;

const CHART_STYLE = {
  background: "transparent",
  overflow: "visible",
  fontSize: "12px",
  fontFamily: "inherit",
  fontVariantNumeric: "tabular-nums",
};

// The figure carries its own text alternative; Plot's per-mark aria-labels sit on role-less <g> elements.
const HIDDEN = "true";

const LINK_CLASS = "plot-link";

const POINTERS: Record<PointerAxis, (options: TipMarkOptions) => Plot.TipOptions> = {
  x: Plot.pointerX,
  y: Plot.pointerY,
  xy: Plot.pointer,
};

function childOf(group: Element, target: EventTarget | null): Element | null {
  let node = target instanceof Element ? target : null;
  while (node && node.parentElement !== group) node = node.parentElement;
  return node;
}

function linkTarget(row: unknown, field: string): string | null {
  const value = (row as Record<string, unknown> | undefined)?.[field];
  return typeof value === "string" ? value : null;
}

// Plot draws one child per index entry in order, so a child's position maps back to its datum.
function linkRender(data: Plot.Data, field: string, onLink: LinkHandler): Plot.RenderFunction {
  const rows = Array.from(data as Iterable<unknown>);
  return (index, scales, values, dimensions, context, next) => {
    const group = next?.(index, scales, values, dimensions, context) ?? null;
    group?.addEventListener("click", (event) => {
      const child = childOf(group, event.target);
      const position = child ? Array.from(group.children).indexOf(child) : -1;
      const to = position >= 0 ? linkTarget(rows[index[position] ?? -1], field) : null;
      if (to) onLink(to);
    });
    return group;
  };
}

function linkOptions<Options extends object>(
  spec: { data: Plot.Data; options: Options; link?: string },
  onLink: LinkHandler | undefined,
): Options {
  if (!spec.link || !onLink) return spec.options;
  return { ...spec.options, className: LINK_CLASS, render: linkRender(spec.data, spec.link, onLink) };
}

function toMark(spec: MarkSpec, onLink: LinkHandler | undefined): Plot.Markish {
  switch (spec.type) {
    case "barX":
      return Plot.barX(spec.data, { ...linkOptions(spec, onLink), ariaHidden: HIDDEN });
    case "barY":
      return Plot.barY(spec.data, { ...linkOptions(spec, onLink), ariaHidden: HIDDEN });
    case "dot":
      return Plot.dot(spec.data, { ...linkOptions(spec, onLink), ariaHidden: HIDDEN });
    case "areaY":
      return Plot.areaY(spec.data, { ...spec.options, ariaHidden: HIDDEN });
    case "lineY":
      return Plot.lineY(spec.data, { ...spec.options, ariaHidden: HIDDEN });
    case "ruleY":
      return Plot.ruleY(spec.data, { ...spec.options, ariaHidden: HIDDEN });
    case "text":
      return Plot.text(spec.data, { ...spec.options, ariaHidden: HIDDEN });
    case "axisY":
      return Plot.axisY({ ...spec.options, ariaHidden: HIDDEN });
    case "tip":
      return Plot.tip(spec.data, POINTERS[spec.pointer]({ ...spec.options, ariaHidden: HIDDEN }));
  }
}

export function renderPlot(
  spec: ChartSpec,
  width: number,
  ariaLabel: string,
  onLink?: LinkHandler,
): SVGSVGElement | HTMLElement {
  const resolved = resolveSpec(spec, width);
  return Plot.plot({
    style: CHART_STYLE,
    ...resolved.options,
    width,
    ariaLabel,
    marks: resolved.marks.map((mark) => toMark(mark, onLink)),
  });
}

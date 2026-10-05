import type {
  AreaYOptions,
  AxisYOptions,
  BarXOptions,
  BarYOptions,
  Data,
  DotOptions,
  LineYOptions,
  PlotOptions,
  PointerOptions,
  RuleYOptions,
  TextOptions,
  TipOptions,
} from "@observablehq/plot";

export type PointerAxis = "x" | "y" | "xy";

interface Linkable {
  link?: string;
}

export type MarkSpec =
  | ({ type: "barX"; data: Data; options: BarXOptions } & Linkable)
  | ({ type: "barY"; data: Data; options: BarYOptions } & Linkable)
  | ({ type: "dot"; data: Data; options: DotOptions } & Linkable)
  | { type: "areaY"; data: Data; options: AreaYOptions }
  | { type: "lineY"; data: Data; options: LineYOptions }
  | { type: "ruleY"; data: Data; options: RuleYOptions }
  | { type: "text"; data: Data; options: TextOptions }
  | { type: "axisY"; options: AxisYOptions }
  | { type: "tip"; data: Data; pointer: PointerAxis; options: TipMarkOptions };

export type TipMarkOptions = TipOptions & PointerOptions;

export type ChartOptions = Omit<PlotOptions, "marks" | "width" | "ariaLabel">;

export interface NarrowLayout {
  below: number;
  marginLeft: number;
  marginRight?: number;
}

export interface ChartSpec {
  marks: MarkSpec[];
  options: ChartOptions;
  narrow?: NarrowLayout;
}

export const AXIS_FONT_PX = 12;
const TICK_GAP_PX = 12;

export function labelEms(marginLeft: number): number {
  return Math.max(1, (marginLeft - TICK_GAP_PX) / AXIS_FONT_PX);
}

export type LabelOverflow = "ellipsis" | "wrap";

export function labelAxis(marginLeft: number, overflow: LabelOverflow = "ellipsis"): MarkSpec {
  const base = { label: null, tickSize: 0, fontSize: AXIS_FONT_PX, lineWidth: labelEms(marginLeft) };
  return { type: "axisY", options: overflow === "wrap" ? base : { ...base, textOverflow: "ellipsis-end" } };
}

function narrowMark(mark: MarkSpec, marginLeft: number): MarkSpec {
  if (mark.type !== "axisY") return mark;
  return { ...mark, options: { ...mark.options, lineWidth: labelEms(marginLeft) } };
}

export function resolveSpec(spec: ChartSpec, width: number): ChartSpec {
  const { narrow } = spec;
  if (!narrow || width >= narrow.below) return spec;
  const { marginLeft, marginRight } = narrow;
  const margins = marginRight === undefined ? { marginLeft } : { marginLeft, marginRight };
  return {
    options: { ...spec.options, ...margins },
    marks: spec.marks.map((mark) => narrowMark(mark, narrow.marginLeft)),
  };
}

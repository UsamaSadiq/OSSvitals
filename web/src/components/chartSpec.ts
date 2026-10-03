import type {
  BarXOptions,
  BarYOptions,
  Data,
  DotOptions,
  LineYOptions,
  PlotOptions,
  RuleYOptions,
  TextOptions,
} from "@observablehq/plot";

export type MarkSpec =
  | { type: "barX"; data: Data; options: BarXOptions }
  | { type: "barY"; data: Data; options: BarYOptions }
  | { type: "dot"; data: Data; options: DotOptions }
  | { type: "lineY"; data: Data; options: LineYOptions }
  | { type: "ruleY"; data: Data; options: RuleYOptions }
  | { type: "text"; data: Data; options: TextOptions };

export interface ChartSpec {
  marks: MarkSpec[];
  options: Omit<PlotOptions, "marks" | "width" | "ariaLabel">;
}

import { formatDelta, NO_CHANGE, type DeltaKind } from "../format";

export type DeltaTone = "good" | "bad" | "neutral";

export interface KpiDelta {
  text: string;
  direction: "up" | "down" | "flat";
  tone: DeltaTone;
}

function directionOf(text: string, value: number): KpiDelta["direction"] {
  if (text === NO_CHANGE) return "flat";
  return value > 0 ? "up" : "down";
}

function toneOf(direction: KpiDelta["direction"], inverse: boolean): DeltaTone {
  if (direction === "flat") return "neutral";
  const improved = (direction === "up") !== inverse;
  return improved ? "good" : "bad";
}

export function kpiDelta(value: number | null | undefined, kind: DeltaKind, inverse = false): KpiDelta | null {
  const text = formatDelta(value, kind);
  if (text === null || value === null || value === undefined) return null;
  const direction = directionOf(text, value);
  return { text, direction, tone: toneOf(direction, inverse) };
}

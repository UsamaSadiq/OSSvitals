import type { Grade } from "./GradePill";
import { GAUGE_MAX } from "./gaugeGeometry";

export interface GaugeBand {
  grade: Grade;
  from: number;
  to: number;
}

export const DEFAULT_GAUGE_BANDS: readonly GaugeBand[] = [
  { grade: "F", from: 0, to: 20 },
  { grade: "D", from: 20, to: 40 },
  { grade: "C", from: 40, to: 60 },
  { grade: "B", from: 60, to: 80 },
  { grade: "A", from: 80, to: 100 },
];

function byLowerBound(a: GaugeBand, b: GaugeBand): number {
  return a.from - b.from;
}

// Config bands are inclusive integer ranges (F 0-19, D 20-39), so each arc runs to the next band's start to leave no gaps.
export function gaugeBands(letterBands: readonly GaugeBand[]): readonly GaugeBand[] {
  if (letterBands.length === 0) return DEFAULT_GAUGE_BANDS;
  const ascending = [...letterBands].sort(byLowerBound);
  return ascending.map((band, index) => ({
    grade: band.grade,
    from: band.from,
    to: ascending[index + 1]?.from ?? GAUGE_MAX,
  }));
}

export function gaugeTicks(bands: readonly GaugeBand[]): number[] {
  const bounds = bands.flatMap((band) => [band.from, band.to]);
  return [...new Set(bounds)].sort((a, b) => a - b);
}

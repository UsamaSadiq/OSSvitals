import type { Chart } from "../../components/charts";

export interface RatePoint {
  date: Date;
  value: number;
}

export function ratePoints(dates: readonly string[], rates: readonly (number | null)[] | undefined): RatePoint[] {
  if (!rates) return [];
  return dates.flatMap((date, index) => {
    const value = rates[index];
    return value === null || value === undefined ? [] : [{ date: new Date(date), value }];
  });
}

export function categorySparkline(category: string, points: readonly RatePoint[]): Chart | null {
  if (points.length < 2) return null;
  return {
    ariaLabel: `${category} pass rate over ${points.length} snapshots`,
    summary: null,
    spec: {
      options: {
        height: 60,
        margin: 4,
        x: { axis: null },
        y: { axis: null, domain: [0, 100] },
      },
      marks: [{ type: "lineY", data: points, options: { x: "date", y: "value", stroke: "var(--accent)", strokeWidth: 2 } }],
    },
  };
}

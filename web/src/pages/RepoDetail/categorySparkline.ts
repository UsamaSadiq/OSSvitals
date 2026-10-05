import { SPARKLINE_POINTER_RADIUS, tipMark, type Chart } from "../../components/charts";
import { toFixedHalfEven } from "../../format";

type Rates = readonly (number | null)[];

export interface DatedRate {
  date: string;
  value: number;
}

export interface RatePoint {
  date: Date;
  value: number;
  tip: string;
}

export type TrendDirection = "up" | "down" | "flat";

export interface CategoryTrend {
  direction: TrendDirection;
  points: number;
  since: string;
}

export function datedRates(dates: readonly string[], rates: Rates | undefined): DatedRate[] {
  if (!rates) return [];
  return dates.flatMap((date, index) => {
    const value = rates[index];
    return value === null || value === undefined ? [] : [{ date, value }];
  });
}

export function ratePoints(dates: readonly string[], rates: Rates | undefined): RatePoint[] {
  return datedRates(dates, rates).map(({ date, value }) => ({
    date: new Date(date),
    value,
    tip: `${date}\n${toFixedHalfEven(value, 0)}% pass`,
  }));
}

export function seriesVaries(points: readonly { value: number }[]): boolean {
  const values = points.map((point) => point.value);
  return values.length > 1 && Math.min(...values) !== Math.max(...values);
}

function direction(points: number): TrendDirection {
  if (points === 0) return "flat";
  return points > 0 ? "up" : "down";
}

export function categoryTrend(rates: readonly DatedRate[]): CategoryTrend | null {
  const first = rates[0];
  const last = rates.at(-1);
  if (!first || !last || rates.length < 2) return null;
  const points = Number(toFixedHalfEven(last.value - first.value, 0)) || 0;
  return { direction: direction(points), points, since: first.date };
}

export function trendText(trend: CategoryTrend): string {
  if (trend.direction === "flat") return `no change since ${trend.since}`;
  const size = Math.abs(trend.points);
  return `${size} ${size === 1 ? "pt" : "pts"} since ${trend.since}`;
}

export function categorySparkline(category: string, points: readonly RatePoint[]): Chart | null {
  if (!seriesVaries(points)) return null;
  return {
    ariaLabel: `${category} pass rate over ${points.length} snapshots`,
    summary: null,
    spec: {
      options: {
        height: 48,
        margin: 4,
        x: { axis: null },
        y: { axis: null, domain: [0, 100] },
      },
      marks: [
        { type: "lineY", data: points, options: { x: "date", y: "value", stroke: "var(--accent)", strokeWidth: 2 } },
        tipMark(points, "x", { x: "date", y: "value", title: "tip", maxRadius: SPARKLINE_POINTER_RADIUS }),
      ],
    },
  };
}

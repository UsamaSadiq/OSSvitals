import { sparklinePoints, trendDirection, type TrendPoint } from "./insights";

const WIDTH = 240;
const HEIGHT = 48;

const DIRECTION_TEXT = {
  "falling-behind": "falling behind",
  "catching-up": "catching up",
  steady: "holding steady",
  unknown: "not enough history yet",
} as const;

export function Sparkline({ points }: { points: readonly TrendPoint[] }) {
  const direction = trendDirection(points);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return <p className="caption">No history yet.</p>;
  if (points.length < 2) return <p className="caption">The trend appears once there are two days of history.</p>;
  const description = `Commits behind upstream from ${first.behind.toLocaleString()} on ${first.date} to ${last.behind.toLocaleString()} on ${last.date}: ${DIRECTION_TEXT[direction]}.`;
  return (
    <figure className="sparkline">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={description} className="sparkline__svg" preserveAspectRatio="none">
        <polyline points={sparklinePoints(points.map((point) => point.behind), WIDTH, HEIGHT)} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="caption">{description}</figcaption>
    </figure>
  );
}

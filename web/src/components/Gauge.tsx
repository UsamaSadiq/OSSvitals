import "./components.css";
import { formatPercent, formatScore } from "../format";
import type { Grade } from "./GradePill";
import { DEFAULT_GAUGE_BANDS, gaugeTicks, type GaugeBand } from "./gaugeBands";
import { arcPath, GAUGE_RADIUS, pointAt } from "./gaugeGeometry";

const BAND_WIDTH = 20;
const FULLY_MEASURED = 0.999;

export interface GaugeProps {
  value: number;
  letter: Grade;
  measuredWeight?: number;
  bands?: readonly GaugeBand[];
}

export function measuredCaveat(measuredWeight: number | undefined): string | null {
  if (measuredWeight === undefined || measuredWeight >= FULLY_MEASURED) return null;
  return `based on ${formatPercent(measuredWeight)} of metric weight`;
}

function gaugeLabel(value: number, letter: Grade, caveat: string | null): string {
  const base = `Org average score ${formatScore(value)} out of 100, grade ${letter}`;
  return caveat ? `${base}, ${caveat}` : base;
}

function Tick({ value }: { value: number }) {
  const label = pointAt(value, GAUGE_RADIUS + BAND_WIDTH / 2 + 10);
  return (
    <text className="gauge__tick" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
      {value}
    </text>
  );
}

export function Gauge({ value, letter, measuredWeight, bands = DEFAULT_GAUGE_BANDS }: GaugeProps) {
  const caveat = measuredCaveat(measuredWeight);
  const marker = { inner: pointAt(value, GAUGE_RADIUS - 15), outer: pointAt(value, GAUGE_RADIUS + 15) };
  const gradeClass = `gauge--${letter.toLowerCase()}`;

  return (
    <figure className={`gauge ${gradeClass}`}>
      <svg viewBox="0 0 240 172" role="img" aria-label={gaugeLabel(value, letter, caveat)}>
        {bands.map((band) => (
          <path
            key={band.grade}
            className={`gauge__band gauge__band--${band.grade.toLowerCase()}`}
            d={arcPath(band.from, band.to)}
            strokeWidth={BAND_WIDTH}
          />
        ))}
        <path className="gauge__value" d={arcPath(0, value)} strokeWidth={BAND_WIDTH / 4} />
        <line
          className="gauge__marker"
          x1={marker.inner.x}
          y1={marker.inner.y}
          x2={marker.outer.x}
          y2={marker.outer.y}
        />
        {gaugeTicks(bands).map((tick) => (
          <Tick key={tick} value={tick} />
        ))}
        <text className="gauge__score" x="120" y="112" textAnchor="middle">
          {formatScore(value)}
        </text>
        <text className="gauge__grade" x="120" y="142" textAnchor="middle">
          Grade {letter}
        </text>
        {caveat && (
          <text className="gauge__caveat" x="120" y="166" textAnchor="middle">
            {caveat}
          </text>
        )}
      </svg>
    </figure>
  );
}

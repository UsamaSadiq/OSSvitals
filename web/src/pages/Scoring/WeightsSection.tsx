import { useMemo } from "react";
import { ChartFigure } from "../../components/ChartFigure";
import { toFixedHalfEven } from "../../format";
import type { MetricRow } from "./scoringText";
import { weightsChart, weightSegments, type WeightSegment } from "./scoringVisuals";

function WeightLegend({ segments }: { segments: readonly WeightSegment[] }) {
  return (
    <ul className="weight-legend" aria-label="Configured weight per metric">
      {segments.map((segment) => (
        <li key={segment.metric} className="weight-legend__item">
          <span className="weight-legend__swatch" style={{ background: segment.fill }} aria-hidden="true" />
          <span className="weight-legend__name">{segment.name}</span>
          <span className="weight-legend__value">{toFixedHalfEven(segment.weight_pct, 0)}%</span>
        </li>
      ))}
    </ul>
  );
}

export function WeightsSection({ rows }: { rows: readonly MetricRow[] }) {
  const chart = useMemo(() => weightsChart(rows), [rows]);
  const segments = useMemo(() => weightSegments(rows), [rows]);
  return (
    <section className="scoring-section" aria-labelledby="weights-heading">
      <h2 id="weights-heading">Weights</h2>
      <p>
        Configured shares of the composite, as set in <code>scoring.yaml</code>. When a metric is not collected for a
        repository, the remaining weights are scaled up to fill its share.
      </p>
      <ChartFigure chart={chart}>
        <WeightLegend segments={segments} />
      </ChartFigure>
    </section>
  );
}

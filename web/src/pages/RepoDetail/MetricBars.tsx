import { useMemo } from "react";
import { PlotFigure } from "../../components/PlotFigure";
import { metricBarsChart, scoringCaption, type MetricBar } from "./metricBarsChart";

export function MetricBars({ bars, version }: { bars: readonly MetricBar[]; version: unknown }) {
  const chart = useMemo(() => metricBarsChart(bars), [bars]);
  return (
    <figure className="chart repo-detail-section">
      {chart.summary && <figcaption className="caption chart__summary">{chart.summary}</figcaption>}
      {bars.length > 0 && <PlotFigure spec={chart.spec} ariaLabel={chart.ariaLabel} />}
      <p className="caption">{scoringCaption(version)}</p>
    </figure>
  );
}

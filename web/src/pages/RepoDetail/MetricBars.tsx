import { useMemo } from "react";
import { PlotFigure } from "../../components/PlotFigure";
import { useView } from "../../data/useView";
import { metricBarsChart, metricRules, scoringCaption, type MetricBar } from "./metricBarsChart";

function useMetricRules() {
  const scoring = useView("scoring");
  const metrics = scoring.data?.metrics;
  return useMemo(() => metricRules(metrics ?? []), [metrics]);
}

export function MetricBars({ bars, version }: { bars: readonly MetricBar[]; version: unknown }) {
  const rules = useMetricRules();
  const chart = useMemo(() => metricBarsChart(bars, rules), [bars, rules]);
  return (
    <figure className="chart repo-detail-section">
      {chart.summary && <figcaption className="caption chart__summary">{chart.summary}</figcaption>}
      {bars.length > 0 && <PlotFigure spec={chart.spec} ariaLabel={chart.ariaLabel} />}
      <p className="caption">{scoringCaption(version)}</p>
    </figure>
  );
}

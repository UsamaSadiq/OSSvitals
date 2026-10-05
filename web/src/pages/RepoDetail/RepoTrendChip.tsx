import { useMemo } from "react";
import { PlotFigure } from "../../components/PlotFigure";
import { useView } from "../../data/useView";
import { repoTrend, trendLabel } from "./repoTrend";

export function RepoTrendChip({ repo }: { repo: string }) {
  const history = useView("history");
  const points = history.data?.repos[repo];
  const trend = useMemo(() => repoTrend(points), [points]);
  if (!trend) return null;
  return (
    <div className="repo-trend">
      <span className="header-chip__label">Composite, 30 days</span>
      <div className="repo-trend__chart">
        <PlotFigure spec={trend.chart.spec} ariaLabel={trend.chart.ariaLabel} />
      </div>
      <span className={`kpi-tile__delta kpi-tile__delta--${trend.delta.tone}`}>{trendLabel(trend)}</span>
    </div>
  );
}

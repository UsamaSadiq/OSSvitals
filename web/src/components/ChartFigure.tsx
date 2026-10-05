import { Fragment, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { Chart, ChartLinkList } from "./charts";
import { PlotFigure } from "./PlotFigure";

export function ChartLinks({ links }: { links: ChartLinkList }) {
  if (links.items.length === 0) return null;
  return (
    <p className="chart-links">
      <span className="chart-links__lead">{links.lead}</span>{" "}
      {links.items.map((item, position) => (
        <Fragment key={item.to}>
          {position > 0 && <span aria-hidden="true"> · </span>}
          <Link to={item.to}>{item.label}</Link>
        </Fragment>
      ))}
    </p>
  );
}

interface ChartFigureProps {
  chart: Chart;
  className?: string;
  children?: ReactNode;
}

// A click that only changes this page's query (e.g. Failing Checks' own chart) replaces the entry,
// matching the page's selector, so Back leaves the page instead of stepping through bars.
function useChartNavigate(): (to: string) => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (to) => navigate(to, { replace: new URL(to, window.location.origin).pathname === pathname });
}

export function ChartFigure({ chart, className = "chart", children }: ChartFigureProps) {
  const navigate = useChartNavigate();
  return (
    <figure className={className}>
      {chart.summary && <figcaption className="caption chart__summary">{chart.summary}</figcaption>}
      <PlotFigure spec={chart.spec} ariaLabel={chart.ariaLabel} onLink={chart.links ? navigate : undefined} />
      {chart.links && <ChartLinks links={chart.links} />}
      {children}
    </figure>
  );
}

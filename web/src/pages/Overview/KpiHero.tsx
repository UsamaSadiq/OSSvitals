import { useMemo } from "react";
import { Gauge } from "../../components/Gauge";
import { DEFAULT_GAUGE_BANDS, gaugeBands, type GaugeBand } from "../../components/gaugeBands";
import { KpiTile } from "../../components/KpiTile";
import { kpiDelta } from "../../components/kpiDelta";
import { PlotFigure } from "../../components/PlotFigure";
import { lastDays, sparklineChart, type SeriesPoint } from "../../components/charts";
import { formatPercent } from "../../format";
import type { OverviewView } from "../../data/schemas";
import { gaugeCaption, measuredHelp, SPARKLINE_DAYS } from "./overviewText";

interface KpiHeroProps {
  overview: OverviewView;
  orgAverage: readonly SeriesPoint[] | null;
  letterBands?: readonly GaugeBand[];
}

function Sparkline({ series }: { series: readonly SeriesPoint[] }) {
  const chart = useMemo(() => sparklineChart(lastDays(series, SPARKLINE_DAYS)), [series]);
  if (!chart) return null;
  return (
    <div className="kpi-hero__sparkline">
      <PlotFigure spec={chart.spec} ariaLabel={chart.ariaLabel} />
      <p className="caption">{chart.summary}</p>
    </div>
  );
}

export function KpiHero({ overview, orgAverage, letterBands }: KpiHeroProps) {
  const { kpis, kpi_deltas: deltas, avg_letter: letter } = overview;
  const bands = useMemo(() => (letterBands ? gaugeBands(letterBands) : DEFAULT_GAUGE_BANDS), [letterBands]);
  return (
    <section className="kpi-hero" aria-label="Key indicators">
      <div className="kpi-hero__gauge">
        <p className="kpi-hero__eyebrow">Org Health</p>
        <Gauge value={kpis.avg_composite} letter={letter} measuredWeight={kpis.avg_measured_weight} bands={bands} />
        <p className="caption">{gaugeCaption(kpis.repos, overview.metadata.snapshot_timestamp)}</p>
      </div>
      <div className="kpi-hero__tiles">
        <div className="kpi-grid">
          <KpiTile label="Grade A" value={kpis.grade_a} delta={kpiDelta(deltas?.grade_a, "int")} />
          <KpiTile label="Grade F" value={kpis.grade_f} delta={kpiDelta(deltas?.grade_f, "int", true)} />
          <KpiTile label="Stale repos" value={kpis.stale} delta={kpiDelta(deltas?.stale, "int", true)} />
          <KpiTile
            label="Score measured"
            value={formatPercent(kpis.avg_measured_weight)}
            help={measuredHelp(kpis.avg_coverage)}
          />
        </div>
        {orgAverage && <Sparkline series={orgAverage} />}
      </div>
    </section>
  );
}

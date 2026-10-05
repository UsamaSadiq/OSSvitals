import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import type { HistoryView, OverviewView, ScoringView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import { useSiteMeta } from "../../layout/siteMeta";
import { ChartTabs } from "./ChartTabs";
import { DirectionalWarning } from "./DirectionalWarning";
import { FullTable } from "./FullTable";
import { GradeMix } from "./GradeMix";
import { Highlights } from "./Highlights";
import { KpiHero } from "./KpiHero";
import { ShareExport } from "./ShareExport";
import { TriageCards } from "./TriageCards";
import { activityLine } from "./overviewText";
import "./overview.css";

interface OverviewSectionsProps {
  overview: OverviewView;
  history: HistoryView | undefined;
  scoring: ScoringView | undefined;
}

function OverviewSections({ overview, history, scoring }: OverviewSectionsProps) {
  const activity = activityLine(overview.kpis.repos, overview.activity_totals);
  return (
    <>
      <DirectionalWarning
        measuredWeight={overview.kpis.avg_measured_weight}
        unavailableMetrics={overview.unavailable_metrics}
      />
      <KpiHero
        overview={overview}
        orgAverage={history?.org_average ?? null}
        letterBands={scoring?.letter_bands}
      />
      {activity && <p className="caption overview-activity">{activity}</p>}
      <TriageCards />
      <GradeMix mix={overview.grade_mix} />
      <ChartTabs overview={overview} />
      <Highlights overview={overview} />
      <FullTable repoCount={overview.kpis.repos} />
      <ShareExport />
    </>
  );
}

function OverviewContent() {
  const overview = useView("overview");
  const history = useView("history");
  const scoring = useView("scoring");
  if (overview.status === "loading") return <Loading label="Loading overview…" />;
  if (overview.status === "error") {
    return <ErrorState title="The overview data could not be loaded." detail={overview.error.message} />;
  }
  return <OverviewSections overview={overview.data} history={history.data} scoring={scoring.data} />;
}

export function Overview() {
  usePageTitle("Overview");
  const { name, tagline } = useSiteMeta();
  return (
    <section className="page overview" aria-labelledby="page-title">
      <h1 id="page-title">{name}</h1>
      {tagline && <p className="caption overview__tagline">{tagline}</p>}
      <SiteFreshnessBanner />
      <OverviewContent />
    </section>
  );
}

import { Link } from "react-router";
import { EmptyState } from "../../components/EmptyState";
import { Tabs, type TabItem } from "../../components/Tabs";
import { categoryPassRateChart, FAILING_CHECKS_PATH, gradeDistributionChart, topFailingChart } from "../../components/charts";
import type { OverviewView } from "../../data/schemas";
import { ChartPanel } from "./ChartPanel";

function CategoryPassRatePanel({ rows }: { rows: OverviewView["category_pass_rates"] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        kind="warn"
        title="No categorisable check columns in this snapshot."
        body="The upstream CSV may have changed shape; per-category rates cannot be computed."
      />
    );
  }
  return <ChartPanel input={rows} build={categoryPassRateChart} />;
}

function TopFailingPanel({ rows }: { rows: OverviewView["top_failing"] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        kind="good"
        title="No failing checks in the current filter scope."
        body="Every check passes for the repositories currently shown."
      />
    );
  }
  return (
    <>
      <ChartPanel input={rows} build={topFailingChart} />
      <p className="caption">
        Every failing check is listed in <Link to={FAILING_CHECKS_PATH}>Failing Checks</Link>.
      </p>
    </>
  );
}

function chartTabs(overview: OverviewView): TabItem[] {
  return [
    {
      id: "grades",
      label: "Grade distribution",
      content: () => <ChartPanel input={overview.grade_mix} build={gradeDistributionChart} />,
    },
    {
      id: "categories",
      label: "Per-category pass rate",
      content: () => <CategoryPassRatePanel rows={overview.category_pass_rates} />,
    },
    {
      id: "failing",
      label: "Top failing checks",
      content: () => <TopFailingPanel rows={overview.top_failing} />,
    },
  ];
}

export function ChartTabs({ overview }: { overview: OverviewView }) {
  return (
    <section className="overview-section" aria-label="Charts">
      <Tabs label="Overview charts" tabs={chartTabs(overview)} />
    </section>
  );
}

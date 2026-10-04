import { useMemo } from "react";
import { Link } from "react-router";
import { topFailingChart } from "../../components/charts";
import { DataTable, type Column, type SortState } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { GradePill, GRADE_ORDER } from "../../components/GradePill";
import { Loading } from "../../components/Loading";
import { PlotFigure } from "../../components/PlotFigure";
import { QuerySelect, useQueryValue } from "../../components/QuerySelect";
import { repoDetailPath } from "../../components/repoDetailPath";
import { ShareLink } from "../../components/ShareLink";
import { useView } from "../../data/useView";
import { formatScore } from "../../format";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import {
  ALL_REPOSITORIES,
  byRepoName,
  capCaption,
  checkOptions,
  reposFailing,
  selectedCheck,
  TOP_N,
  type FailingCheckRow,
  type RepoRow,
} from "./failingRows";

const CHECK_PARAM = "category";

const BY_SCORE_ASCENDING: SortState = { key: "score", direction: "ascending" };

const COLUMNS: Column<RepoRow>[] = [
  {
    key: "repo",
    header: "Repository",
    cell: (row) => <Link to={repoDetailPath(row.repo_name)}>{row.repo_name}</Link>,
    sortValue: (row) => row.repo_name,
  },
  {
    key: "score",
    header: "Score",
    cell: (row) => formatScore(row.score_composite),
    sortValue: (row) => row.score_composite,
    numeric: true,
  },
  {
    key: "grade",
    header: "Grade",
    cell: (row) => <GradePill grade={row.score_letter} />,
    sortValue: (row) => GRADE_ORDER.indexOf(row.score_letter),
  },
];

function NoFailingChecks() {
  return (
    <EmptyState
      kind="good"
      title="No failing checks detected."
      body="Every collected check passes across the whole organisation."
    />
  );
}

function MostFailedChart({ checks }: { checks: readonly FailingCheckRow[] }) {
  const chart = useMemo(() => topFailingChart(checks.slice(0, TOP_N)), [checks]);
  const caption = capCaption(checks.length);
  return (
    <>
      <h2>Most-failed checks</h2>
      <figure className="chart">
        {chart.summary && <figcaption className="caption chart__summary">{chart.summary}</figcaption>}
        <PlotFigure spec={chart.spec} ariaLabel={chart.ariaLabel} />
      </figure>
      {caption && <p className="caption">{caption}</p>}
    </>
  );
}

function FailCountCaption({ count, check }: { count: number; check: string }) {
  return (
    <p className="caption">
      {count} repositories fail <code>{check}</code>.
    </p>
  );
}

function RepoTable({ rows }: { rows: readonly RepoRow[] }) {
  return (
    <DataTable
      caption="Repositories by failing check"
      captionHidden
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.repo_name}
      initialSort={BY_SCORE_ASCENDING}
      tieBreak={byRepoName}
      emptyMessage="No repositories fail the selected check."
    />
  );
}

function CheckInspector({ checks, repos }: { checks: readonly FailingCheckRow[]; repos: readonly RepoRow[] }) {
  const options = useMemo(() => checkOptions(checks), [checks]);
  const check = selectedCheck(useQueryValue(CHECK_PARAM, options, ALL_REPOSITORIES));
  const rows = useMemo(() => reposFailing(repos, check), [repos, check]);
  return (
    <>
      <QuerySelect label="Inspect a check" param={CHECK_PARAM} options={options} defaultValue={ALL_REPOSITORIES} />
      {check !== null && <FailCountCaption count={rows.length} check={check} />}
      <RepoTable rows={rows} />
    </>
  );
}

function FailingChecksContent() {
  const failing = useView("failing_checks");
  const repos = useView("repos");
  if (failing.status === "loading" || repos.status === "loading") return <Loading label="Loading failing checks…" />;
  if (failing.status === "error") {
    return <ErrorState title="The failing checks could not be loaded." detail={failing.error.message} />;
  }
  if (repos.status === "error") {
    return <ErrorState title="The repositories could not be loaded." detail={repos.error.message} />;
  }
  const checks = failing.data.records;
  if (checks.length === 0) return <NoFailingChecks />;
  return (
    <>
      <MostFailedChart checks={checks} />
      <CheckInspector checks={checks} repos={repos.data.records} />
      <ShareLink label="Copy link to this view" />
    </>
  );
}

export function FailingChecks() {
  usePageTitle("Failing Checks");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">Failing Checks</h1>
      <SiteFreshnessBanner />
      <FailingChecksContent />
    </section>
  );
}

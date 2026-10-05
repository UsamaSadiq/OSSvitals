import { useMemo } from "react";
import { ChartFigure } from "../../components/ChartFigure";
import { DataTable, type Column } from "../../components/DataTable";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { RepoLink } from "../../components/RepoName";
import { useView } from "../../data/useView";
import { toFixedHalfEven } from "../../format";
import { RepoPicker, useSelectedRepo } from "../RepoDetail/RepoPicker";
import { sortedRepos } from "../RepoDetail/repoRanking";
import type { MetricRow } from "./scoringText";
import {
  contributionChart,
  metricFills,
  scoreBreakdown,
  type Contribution,
  type MetricBar,
  type ScoreBreakdown,
} from "./scoringVisuals";

const NO_VALUE = "—";

function scoreCell(row: Contribution): string {
  if (row.state === "unavailable") return "not collected";
  const score = toFixedHalfEven(row.score, 1);
  return row.state === "defaulted" ? `${score} (default)` : score;
}

function weightCell(weight: number | null): string {
  return weight === null ? NO_VALUE : `${toFixedHalfEven(weight * 100, 0)}%`;
}

function shareCell(row: Contribution): string {
  return row.state === "unavailable" ? NO_VALUE : `${toFixedHalfEven(row.share * 100, 1)}%`;
}

const COLUMNS: Column<Contribution>[] = [
  { key: "metric", header: "Metric", cell: (row) => row.name },
  { key: "score", header: "Score", cell: scoreCell, numeric: true },
  { key: "weight", header: "Configured weight", cell: (row) => weightCell(row.weight), numeric: true },
  { key: "share", header: "Share used", cell: shareCell, numeric: true },
  { key: "points", header: "Points", cell: (row) => toFixedHalfEven(row.points, 2), numeric: true },
];

function hasDefaults(breakdown: ScoreBreakdown): boolean {
  return breakdown.rows.some((row) => row.state === "defaulted");
}

export function breakdownTotalText(breakdown: ScoreBreakdown): string {
  return `Points add up to ${toFixedHalfEven(breakdown.total, 2)}; the published composite is ${toFixedHalfEven(breakdown.composite, 2)}.`;
}

export function defaultRepo(names: readonly string[], requested: string | null): string | null {
  if (requested !== null && names.includes(requested)) return requested;
  return sortedRepos(names)[0] ?? null;
}

interface BreakdownProps {
  repo: string;
  bars: readonly MetricBar[];
  composite: number;
  metrics: readonly MetricRow[];
}

function Breakdown({ repo, bars, composite, metrics }: BreakdownProps) {
  const breakdown = useMemo(() => scoreBreakdown(bars, composite), [bars, composite]);
  const fills = useMemo(() => metricFills(metrics), [metrics]);
  const chart = useMemo(() => contributionChart(repo, breakdown, fills), [repo, breakdown, fills]);
  return (
    <>
      <ChartFigure chart={chart} />
      <DataTable
        caption={`Score contributions for ${repo}`}
        captionHidden
        columns={COLUMNS}
        rows={breakdown.rows}
        rowKey={(row) => row.metric}
        emptyMessage="No metric scores for this repository."
      />
      <p className="caption">
        {breakdownTotalText(breakdown)} Points = score × share used.
        {breakdown.renormalised && " Metrics not collected are left out, so the others' shares grow to fill 100%."}
        {hasDefaults(breakdown) && " Grey segments are defaults for missing data, not measurements."} Full detail:{" "}
        <RepoLink name={repo} />.
      </p>
    </>
  );
}

function BreakdownContent({ metrics }: { metrics: readonly MetricRow[] }) {
  const repos = useView("repos");
  const detail = useView("repo_detail");
  const [requested, select] = useSelectedRepo();
  const error = repos.error ?? detail.error;
  if (error) return <ErrorState title="The repository scores could not be loaded." detail={error.message} />;
  if (repos.status !== "ready" || detail.status !== "ready") return <Loading label="Loading repository scores…" />;
  const records = repos.data.records.filter((record) => detail.data.repos[record.repo_name]);
  const names = records.map((record) => record.repo_name);
  const repo = defaultRepo(names, requested);
  const record = records.find((candidate) => candidate.repo_name === repo);
  const entry = repo === null ? undefined : detail.data.repos[repo];
  return (
    <>
      <RepoPicker repos={names} selected={repo} initialQuery={repo ?? ""} onSelect={select} />
      {repo && record && entry ? (
        <Breakdown repo={repo} bars={entry.metric_bars} composite={record.score_composite} metrics={metrics} />
      ) : (
        <p className="caption">No scored repositories in this snapshot.</p>
      )}
    </>
  );
}

export function ScoreBreakdownSection({ metrics }: { metrics: readonly MetricRow[] }) {
  return (
    <section className="scoring-section" aria-labelledby="breakdown-heading">
      <h2 id="breakdown-heading">How a score is built</h2>
      <p>
        Pick a repository to see each metric's points. Every metric scores 0 to 100; its points are that score times
        its share of the weight, and the points add up to the composite.
      </p>
      <BreakdownContent metrics={metrics} />
    </section>
  );
}

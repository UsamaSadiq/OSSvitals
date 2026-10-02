import { Link } from "react-router";
import { DataTable, type Column, type SortState } from "../../components/DataTable";
import { ErrorState } from "../../components/ErrorState";
import { GradePill, GRADE_ORDER } from "../../components/GradePill";
import { Loading } from "../../components/Loading";
import { repoDetailPath } from "../../components/repoDetailPath";
import type { ReposView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { formatScore } from "../../format";
import { fullTableTitle } from "./overviewText";

type RepoRow = ReposView["records"][number];

const BY_SCORE: SortState = { key: "score", direction: "descending" };

function byRepoName(a: RepoRow, b: RepoRow): number {
  if (a.repo_name === b.repo_name) return 0;
  return a.repo_name < b.repo_name ? -1 : 1;
}

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
    cell: (row) => (
      <span className="score-bar">
        <span className="score-bar__track" aria-hidden="true">
          <span className="score-bar__fill" style={{ width: `${Math.max(0, Math.min(100, row.score_composite))}%` }} />
        </span>
        {formatScore(row.score_composite)}
      </span>
    ),
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

function RepoTable({ title }: { title: string }) {
  const repos = useView("repos");
  if (repos.status === "loading") return <Loading label="Loading repositories…" />;
  if (repos.status === "error") return <ErrorState title="The full table could not be loaded." detail={repos.error.message} />;
  return (
    <DataTable
      caption={title}
      captionHidden
      columns={COLUMNS}
      rows={repos.data.records}
      rowKey={(row) => row.repo_name}
      initialSort={BY_SCORE}
      tieBreak={byRepoName}
      maxHeight="460px"
    />
  );
}

export function FullTable({ repoCount }: { repoCount: number }) {
  const title = fullTableTitle(repoCount);
  return (
    <details className="overview-section full-table">
      <summary>{title}</summary>
      <RepoTable title={title} />
    </details>
  );
}

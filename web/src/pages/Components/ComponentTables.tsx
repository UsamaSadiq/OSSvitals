import { DataTable, type Column } from "../../components/DataTable";
import { GradePill, GRADE_ORDER, isGrade } from "../../components/GradePill";
import { RepoLink, RepoName } from "../../components/RepoName";
import { formatNumber } from "../../format";
import { releaseLabel, type ComponentRow, type FindingRepo } from "./componentRows";

interface RepoRow {
  repo_name: string;
  score_letter?: string | null;
}

function repoColumn<Row extends RepoRow>(): Column<Row> {
  return {
    key: "repo_name",
    header: "Repository",
    cell: (row) => (row.score_letter ? <RepoLink name={row.repo_name} /> : <RepoName name={row.repo_name} />),
    sortValue: (row) => row.repo_name,
  };
}

function gradeRank(letter: string | null | undefined): number {
  return letter && isGrade(letter) ? GRADE_ORDER.indexOf(letter) : GRADE_ORDER.length;
}

function gradeColumn<Row extends RepoRow>(): Column<Row> {
  return {
    key: "score_letter",
    header: "Grade",
    cell: (row) => (row.score_letter ? <GradePill grade={row.score_letter} /> : ""),
    sortValue: (row) => gradeRank(row.score_letter),
  };
}

function textColumn<Row>(key: string, header: string, text: (row: Row) => string): Column<Row> {
  return { key, header, cell: text, sortValue: text };
}

const FINDING_COLUMNS: Column<FindingRepo>[] = [
  repoColumn(),
  gradeColumn(),
  textColumn("owner", "Owner", (row) => row.owner ?? ""),
];

const COMPONENT_COLUMNS: Column<ComponentRow>[] = [
  repoColumn(),
  textColumn("type", "Type", (row) => row.type ?? ""),
  textColumn("lifecycle", "Lifecycle", (row) => row.lifecycle ?? ""),
  textColumn("owner", "Owner", (row) => row.owner ?? ""),
  textColumn("release", "Release", (row) => releaseLabel(row.release)),
  gradeColumn(),
  {
    key: "finding_count",
    header: "Findings",
    cell: (row) => formatNumber(row.finding_count),
    sortValue: (row) => row.finding_count,
    numeric: true,
  },
  {
    key: "backstage_url",
    header: "Backstage",
    cell: (row) => (row.backstage_url ? <a href={row.backstage_url}>Backstage</a> : ""),
  },
];

export function FindingReposTable({ label, repos }: { label: string; repos: readonly FindingRepo[] }) {
  return (
    <DataTable
      caption={`Repositories with ${label}`}
      captionHidden
      columns={FINDING_COLUMNS}
      rows={repos}
      rowKey={(row) => row.repo_name}
    />
  );
}

export function ComponentsTable({ rows }: { rows: readonly ComponentRow[] }) {
  return (
    <DataTable
      caption="Declared components"
      captionHidden
      columns={COMPONENT_COLUMNS}
      rows={rows}
      rowKey={(row) => row.repo_name}
      emptyMessage="No components match these filters."
      maxHeight="460px"
    />
  );
}

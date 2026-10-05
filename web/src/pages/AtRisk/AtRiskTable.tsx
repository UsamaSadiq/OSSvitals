import { DataTable, type Column } from "../../components/DataTable";
import { GradePill, GRADE_ORDER } from "../../components/GradePill";
import { RepoLink } from "../../components/RepoName";
import { formatNumber, formatScore } from "../../format";
import { formatSignedDelta, type AtRiskRow } from "./atRiskText";

function optionalScore(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : formatScore(value);
}

function optionalCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : formatNumber(value);
}

function missingLast(value: number | null | undefined): number {
  return value ?? Number.NEGATIVE_INFINITY;
}

type TextField = "owner_status" | "owner" | "lifecycle" | "release" | "reasons";

function textColumn(key: TextField, header: string): Column<AtRiskRow> {
  const text = (row: AtRiskRow) => row[key] ?? "";
  return { key, header, cell: text, sortValue: text };
}

const COLUMNS: Column<AtRiskRow>[] = [
  {
    key: "repo_name",
    header: "Repository",
    cell: (row) => <RepoLink name={row.repo_name} />,
    sortValue: (row) => row.repo_name,
  },
  textColumn("owner_status", "Ownership"),
  textColumn("owner", "Owner"),
  textColumn("lifecycle", "Lifecycle"),
  textColumn("release", "Release"),
  {
    key: "score_composite",
    header: "Score",
    cell: (row) => formatScore(row.score_composite),
    sortValue: (row) => row.score_composite,
    numeric: true,
  },
  {
    key: "score_letter",
    header: "Grade",
    cell: (row) => <GradePill grade={row.score_letter} />,
    sortValue: (row) => GRADE_ORDER.indexOf(row.score_letter),
  },
  {
    key: "score_activity",
    header: "Activity",
    cell: (row) => optionalScore(row.score_activity),
    sortValue: (row) => missingLast(row.score_activity),
    numeric: true,
  },
  {
    key: "days_since_push",
    header: "Days since push",
    cell: (row) => optionalCount(row.days_since_push),
    sortValue: (row) => missingLast(row.days_since_push),
    numeric: true,
  },
  {
    key: "delta",
    header: "Change",
    cell: (row) => formatSignedDelta(row.delta),
    sortValue: (row) => missingLast(row.delta),
    numeric: true,
  },
  textColumn("reasons", "Why flagged"),
  {
    key: "catalog_link",
    header: "Backstage",
    cell: (row) => (row.catalog_link ? <a href={row.catalog_link}>Catalog</a> : ""),
  },
];

export function AtRiskTable({ rows }: { rows: readonly AtRiskRow[] }) {
  return (
    <DataTable
      caption="Repositories at risk"
      captionHidden
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.repo_name}
    />
  );
}

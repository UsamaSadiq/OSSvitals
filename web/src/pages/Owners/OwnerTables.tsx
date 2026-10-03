import { Link } from "react-router";
import { DataTable, type Column } from "../../components/DataTable";
import { GradePill, GRADE_ORDER, type Grade } from "../../components/GradePill";
import { repoDetailPath } from "../../components/repoDetailPath";
import { formatNumber, formatScore } from "../../format";
import {
  groupLabel,
  OWNER_PARAM,
  type GroupName,
  type GroupRow,
  type HandleRepo,
  type OwnerRecord,
  type OwnerRepo,
} from "./ownerText";

interface ScoredRepo {
  repo_name: string;
  score_composite: number;
  score_letter: Grade;
}

function ownerSearch(key: string): string {
  return `?${new URLSearchParams({ [OWNER_PARAM]: key }).toString()}`;
}

function oneDecimal(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : formatScore(value);
}

function missingLast(value: number | null | undefined): number {
  return value ?? Number.NEGATIVE_INFINITY;
}

function countColumn<Row>(key: string, header: string, value: (row: Row) => number): Column<Row> {
  return { key, header, cell: (row) => formatNumber(value(row)), sortValue: value, numeric: true };
}

function averageColumn<Row>(value: (row: Row) => number): Column<Row> {
  const cell = (row: Row) => oneDecimal(value(row));
  return { key: "avg_score", header: "Average score", cell, sortValue: value, numeric: true };
}

function textColumn<Row>(key: string, header: string, value: (row: Row) => string | null | undefined): Column<Row> {
  const text = (row: Row) => value(row) ?? "";
  return { key, header, cell: text, sortValue: text };
}

function scoredRepoColumns<Row extends ScoredRepo>(): Column<Row>[] {
  return [
    {
      key: "repo_name",
      header: "Repository",
      cell: (row) => <Link to={repoDetailPath(row.repo_name)}>{row.repo_name}</Link>,
      sortValue: (row) => row.repo_name,
    },
    {
      key: "score_composite",
      header: "Score",
      cell: (row) => oneDecimal(row.score_composite),
      sortValue: (row) => row.score_composite,
      numeric: true,
    },
    {
      key: "score_letter",
      header: "Grade",
      cell: (row) => <GradePill grade={row.score_letter} />,
      sortValue: (row) => GRADE_ORDER.indexOf(row.score_letter),
    },
  ];
}

const OWNER_COLUMNS: Column<OwnerRecord>[] = [
  {
    key: "owner",
    header: "Owner",
    cell: (row) => <Link to={{ search: ownerSearch(row.owner_key) }}>{row.owner}</Link>,
    sortValue: (row) => row.owner,
  },
  textColumn("owner_type", "Type", (row) => row.owner_type),
  countColumn("repo_count", "Repositories", (row) => row.repo_count),
  averageColumn((row) => row.avg_score),
  countColumn("d_or_f", "Grade D or F", (row) => row.d_or_f),
  countColumn("at_risk", "At risk", (row) => row.at_risk),
];

const OWNER_REPO_COLUMNS: Column<OwnerRepo>[] = [
  ...scoredRepoColumns<OwnerRepo>(),
  {
    key: "score_activity",
    header: "Activity",
    cell: (row) => oneDecimal(row.score_activity),
    sortValue: (row) => missingLast(row.score_activity),
    numeric: true,
  },
  textColumn("lifecycle", "Lifecycle", (row) => row.lifecycle),
  textColumn("release", "Release", (row) => row.release),
  {
    key: "catalog_link",
    header: "Backstage",
    cell: (row) => (row.catalog_link ? <a href={row.catalog_link}>Catalog</a> : ""),
  },
];

const HANDLE_COLUMNS = scoredRepoColumns<HandleRepo>();

const GROUP_HEADERS: Record<GroupName, string> = { theme: "Theme", squad: "Squad" };
const GROUP_EMPTY: Record<GroupName, string> = { theme: "No themes found.", squad: "No squads found." };

function groupColumns(group: GroupName): Column<GroupRow>[] {
  return [
    textColumn(group, GROUP_HEADERS[group], (row) => groupLabel(row, group)),
    countColumn("repo_count", "Repositories", (row) => row.repo_count),
    averageColumn((row) => row.avg_score),
    countColumn("d_or_f", "Grade D or F", (row) => row.d_or_f),
  ];
}

const GROUP_COLUMNS: Record<GroupName, Column<GroupRow>[]> = {
  theme: groupColumns("theme"),
  squad: groupColumns("squad"),
};

export function OwnerSummaryTable({ rows }: { rows: readonly OwnerRecord[] }) {
  return (
    <DataTable
      caption="Owners"
      captionHidden
      columns={OWNER_COLUMNS}
      rows={rows}
      rowKey={(row) => row.owner_key}
      emptyMessage="No owners found."
      maxHeight="360px"
    />
  );
}

export function OwnerReposTable({ owner, rows }: { owner: string; rows: readonly OwnerRepo[] }) {
  return (
    <DataTable
      caption={`Repositories owned by ${owner}`}
      captionHidden
      columns={OWNER_REPO_COLUMNS}
      rows={rows}
      rowKey={(row) => row.repo_name}
    />
  );
}

export function GroupTable({ group, rows }: { group: GroupName; rows: readonly GroupRow[] }) {
  return (
    <DataTable
      caption={`Repositories by ${group}`}
      captionHidden
      columns={GROUP_COLUMNS[group]}
      rows={rows}
      rowKey={(row) => groupLabel(row, group)}
      emptyMessage={GROUP_EMPTY[group]}
    />
  );
}

export function HandleReposTable({ rows }: { rows: readonly HandleRepo[] }) {
  return (
    <DataTable
      caption="Repositories matching the handle"
      captionHidden
      columns={HANDLE_COLUMNS}
      rows={rows}
      rowKey={(row) => row.repo_name}
    />
  );
}

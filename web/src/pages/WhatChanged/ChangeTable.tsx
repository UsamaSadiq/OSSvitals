import { Link } from "react-router";
import { DataTable, type Column } from "../../components/DataTable";
import { repoDetailPath } from "../../components/repoDetailPath";
import type { WhatChangedView } from "../../data/schemas";

type ChangeRow = WhatChangedView["new_failures"][number];

const COLUMNS: Column<ChangeRow>[] = [
  {
    key: "repo_name",
    header: "Repository",
    cell: (row) => <Link to={repoDetailPath(row.repo_name)}>{row.repo_name}</Link>,
    sortValue: (row) => row.repo_name,
  },
  { key: "check", header: "Check", cell: (row) => row.check, sortValue: (row) => row.check },
];

const rowKey = (row: ChangeRow) => `${row.repo_name}\u0000${row.check}`;

export function ChangeTable({ caption, rows }: { caption: string; rows: readonly ChangeRow[] }) {
  return <DataTable caption={caption} captionHidden columns={COLUMNS} rows={rows} rowKey={rowKey} />;
}

import { DataTable, type Column } from "../../components/DataTable";
import { RepoLink } from "../../components/RepoName";
import type { WhatChangedView } from "../../data/schemas";

type ChangeRow = WhatChangedView["new_failures"][number];

const COLUMNS: Column<ChangeRow>[] = [
  {
    key: "repo_name",
    header: "Repository",
    cell: (row) => <RepoLink name={row.repo_name} />,
    sortValue: (row) => row.repo_name,
  },
  { key: "check", header: "Check", cell: (row) => row.check, sortValue: (row) => row.check },
];

const rowKey = (row: ChangeRow) => `${row.repo_name}\u0000${row.check}`;

export function ChangeTable({ caption, rows }: { caption: string; rows: readonly ChangeRow[] }) {
  return <DataTable caption={caption} captionHidden columns={COLUMNS} rows={rows} rowKey={rowKey} />;
}

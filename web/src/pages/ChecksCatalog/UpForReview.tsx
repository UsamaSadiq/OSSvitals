import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import type { ChecksView } from "../../data/schemas";
import { formatNumber } from "../../format";
import {
  formatPct,
  formatThreshold,
  NO_VALUE,
  saturatedRows,
  sparseRows,
  windowText,
  type SaturatedRow,
  type SparseRow,
} from "./catalogData";

const SATURATED_COLUMNS: Column<SaturatedRow>[] = [
  { key: "check", header: "Check", cell: (row) => row.check, sortValue: (row) => row.check },
  { key: "dominant", header: "Value almost every repo has", cell: (row) => row.dominant, sortValue: (row) => row.dominant },
  { key: "share", header: "Share", cell: (row) => formatPct(row.sharePct), sortValue: (row) => row.sharePct ?? -1, numeric: true },
  {
    key: "outliers",
    header: "Repos with another value",
    cell: (row) => (row.outliers === null ? NO_VALUE : formatNumber(row.outliers)),
    sortValue: (row) => row.outliers ?? -1,
    numeric: true,
  },
];

const SPARSE_COLUMNS: Column<SparseRow>[] = [
  { key: "check", header: "Check", cell: (row) => row.check, sortValue: (row) => row.check },
  { key: "fill", header: "Repos reporting it", cell: (row) => formatPct(row.fillPct), sortValue: (row) => row.fillPct ?? -1, numeric: true },
];

function Intro({ checks }: { checks: ChecksView }) {
  return (
    <p>
      Checks that no longer tell repositories apart, in {windowText(checks.review_window)}.{" "}
      <strong>Saturated</strong>: one value holds at least {formatThreshold(checks.saturation_share)} of the repos that
      report it. <strong>Sparse</strong>: fewer than {formatThreshold(checks.sparse_fill)} of repos report it at all.
      These are raised with the Maintenance Working Group, which decides whether to retire a check, keep it to catch
      regressions, or fix its detection.
    </p>
  );
}

function SaturatedTable({ rows }: { rows: SaturatedRow[] }) {
  if (rows.length === 0) return null;
  return (
    <>
      <h3>Saturated ({rows.length})</h3>
      <DataTable caption="Saturated checks" captionHidden columns={SATURATED_COLUMNS} rows={rows} rowKey={(row) => row.check} />
    </>
  );
}

function SparseTable({ rows }: { rows: SparseRow[] }) {
  if (rows.length === 0) return null;
  return (
    <>
      <h3>Sparse ({rows.length})</h3>
      <DataTable caption="Sparse checks" captionHidden columns={SPARSE_COLUMNS} rows={rows} rowKey={(row) => row.check} />
    </>
  );
}

function Flagged({ checks }: { checks: ChecksView }) {
  if (checks.up_for_review.length === 0) {
    return <EmptyState kind="good" title="No check is saturated or sparse across the retained history." />;
  }
  return (
    <>
      <SaturatedTable rows={saturatedRows(checks.up_for_review)} />
      <SparseTable rows={sparseRows(checks.up_for_review)} />
    </>
  );
}

export function UpForReview({ checks }: { checks: ChecksView }) {
  return (
    <section className="checks-catalog__section" aria-labelledby="up-for-review">
      <h2 id="up-for-review">Up for review</h2>
      <Intro checks={checks} />
      <Flagged checks={checks} />
    </section>
  );
}

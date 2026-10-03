import { Fragment } from "react";
import { Link } from "react-router";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { GradePill, GRADE_ORDER } from "../../components/GradePill";
import { repoDetailPath } from "../../components/repoDetailPath";
import { CodeText } from "../../components/CodeText";
import {
  formatSignedChange,
  formatWholePercent,
  pendingSwaps,
  versionText,
  type ChangeRow,
  type Proposed,
  type SwapRow,
} from "./scoringText";

type Migration = Proposed["migration"];

const SWAP_COLUMNS: Column<SwapRow>[] = [
  { key: "metric", header: "Metric", cell: (row) => row.metric, sortValue: (row) => row.metric },
  { key: "replaces", header: "Replaces", cell: (row) => row.replaces, sortValue: (row) => row.replaces },
  { key: "rule", header: "Proposed rule", cell: (row) => <CodeText text={row.rule} /> },
  {
    key: "measured",
    header: "Measured",
    cell: (row) => formatWholePercent(row.measured_pct),
    sortValue: (row) => row.measured_pct ?? -1,
    numeric: true,
  },
];

const CHANGE_COLUMNS: Column<ChangeRow>[] = [
  {
    key: "repo",
    header: "Repository",
    cell: (row) => <Link to={repoDetailPath(row.repo_name)}>{row.repo_name}</Link>,
    sortValue: (row) => row.repo_name,
  },
  {
    key: "current",
    header: "Current",
    cell: (row) => <GradePill grade={row.current} />,
    sortValue: (row) => GRADE_ORDER.indexOf(row.current),
  },
  {
    key: "proposed",
    header: "Proposed",
    cell: (row) => <GradePill grade={row.proposed} />,
    sortValue: (row) => GRADE_ORDER.indexOf(row.proposed),
  },
  {
    key: "change",
    header: "Score change",
    cell: (row) => formatSignedChange(row.change),
    sortValue: (row) => row.change,
    numeric: true,
  },
];

function PendingInputs({ swaps }: { swaps: readonly SwapRow[] }) {
  const pending = pendingSwaps(swaps);
  if (pending.length === 0) return null;
  const names = pending.map((row, index) => (
    <Fragment key={row.metric}>
      {index > 0 && ", "}
      <strong>{row.metric}</strong> (<code>{row.source}</code>)
    </Fragment>
  ));
  // EmptyState takes a plain-string title; these names need bold and code markup, so the banner is built here.
  return (
    <div className="banner banner--info" role="status">
      <strong>Not in this snapshot yet: {names}.</strong>
      <p>
        The upstream checks that report these are pending, so the comparison below keeps the current metric in their
        place until they arrive.
      </p>
    </div>
  );
}

function MigrationGrid({ migration }: { migration: Migration }) {
  const rows = Object.entries(migration);
  const proposedGrades = Object.keys(rows[0]?.[1] ?? {});
  return (
    <div className="table-scroll data-table__scroll" role="region" aria-label="How grades would move" tabIndex={0}>
      <table className="data-table scoring-migration">
        <caption className="visually-hidden">How grades would move</caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2}>
              Current grade
            </th>
            <th scope="colgroup" colSpan={proposedGrades.length}>
              Proposed grade
            </th>
          </tr>
          <tr>
            {proposedGrades.map((grade) => (
              <th key={grade} scope="col" className="data-table__numeric">
                {grade}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([current, counts]) => (
            <tr key={current}>
              <th scope="row">{current}</th>
              {proposedGrades.map((grade) => (
                <td key={grade} className="data-table__numeric">
                  {counts[grade] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GradeChanges({ changes }: { changes: readonly ChangeRow[] }) {
  if (changes.length === 0) {
    return <EmptyState kind="info" title="No repository changes letter grade under the proposed method." />;
  }
  return (
    <>
      <p>{changes.length} repositories would change letter grade:</p>
      <DataTable
        caption="Repositories that would change letter grade"
        captionHidden
        columns={CHANGE_COLUMNS}
        rows={changes}
        rowKey={(row) => row.repo_name}
      />
    </>
  );
}

export function ProposedSection({ proposed }: { proposed: Proposed }) {
  return (
    <section className="scoring-section" aria-labelledby="proposed-heading">
      <h2 id="proposed-heading">Proposed changes</h2>
      <p>
        Scoring version {versionText(proposed.version)} replaces metrics that reward a file or a tool being set up
        with ones that measure the outcome. It is <strong>not live</strong>: every grade on this dashboard still uses
        the method above until the Open edX Maintenance Working Group agrees the change.
      </p>
      <DataTable
        caption="Proposed metric swaps"
        captionHidden
        columns={SWAP_COLUMNS}
        rows={proposed.swaps}
        rowKey={(row) => row.metric}
        emptyMessage="No repositories to show."
      />
      <PendingInputs swaps={proposed.swaps} />
      <h3>How grades would move</h3>
      <MigrationGrid migration={proposed.migration} />
      <p className="caption">Rows are today's grades, columns the proposed ones; the diagonal is unchanged.</p>
      <GradeChanges changes={proposed.changes} />
    </section>
  );
}

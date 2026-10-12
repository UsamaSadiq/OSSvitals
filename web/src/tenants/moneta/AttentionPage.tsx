import { Link } from "react-router";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { usePageTitle } from "../../layout/pageTitle";
import { StatusPill } from "./StatusPill";
import { attentionReasons } from "./insights";
import { appPath } from "./paths";
import { STATUS_LABELS, forkRows, needingAttention, type ForkRow } from "./rows";
import type { ConflictRecord } from "./schemas";
import { useMonetaViews, type MonetaViews } from "./useMonetaViews";
import "./moneta.css";

const GROUPS = ["critical", "stale"] as const;

function AttentionCard({ row, conflict }: { row: ForkRow; conflict: ConflictRecord | undefined }) {
  const { app, drift } = row;
  const headingId = `attention-${app.repo}`;
  return (
    <article className={`fork-card fork-card--${drift.status}`} aria-labelledby={headingId}>
      <header className="fork-card__header">
        <h3 id={headingId}>
          <Link to={appPath(app.repo)}>{app.repo}</Link>
        </h3>
        <StatusPill status={drift.status} />
      </header>
      <ul className="attention-reasons">
        {attentionReasons(row, conflict).map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </article>
  );
}

function Group({ status, rows, views }: { status: (typeof GROUPS)[number]; rows: readonly ForkRow[]; views: MonetaViews }) {
  const headingId = `attention-group-${status}`;
  return (
    <section className="overview-section" aria-labelledby={headingId}>
      <h2 id={headingId}>{`${STATUS_LABELS[status]} (${rows.length})`}</h2>
      <ul className="fork-cards">
        {rows.map((row) => (
          <li key={row.app.repo}>
            <AttentionCard row={row} conflict={views.conflicts?.records.find((record) => record.repo === row.app.repo)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Content() {
  const state = useMonetaViews();
  if (state.status === "loading") return <Loading label="Loading fork status…" />;
  if (state.status === "error") return <ErrorState title="The fork status data could not be loaded." detail={state.message} />;
  const forks = forkRows(state.apps.records, state.drift.records);
  const urgent = needingAttention(forks);
  if (urgent.length === 0) return <EmptyState kind="good" title="No fork is stale or critical." />;
  return (
    <>
      <p className="caption">{`${urgent.length} of ${forks.length} forks are stale or critical. Each card says why. Open one for the full picture.`}</p>
      {GROUPS.map((status) => {
        const rows = urgent.filter((row) => row.drift.status === status);
        return rows.length > 0 ? <Group key={status} status={status} rows={rows} views={state} /> : null;
      })}
    </>
  );
}

export function MonetaAttention() {
  usePageTitle("Needs attention");
  return (
    <section className="page overview" aria-labelledby="page-title">
      <h1 id="page-title">Needs attention</h1>
      <Content />
    </section>
  );
}

import { Link } from "react-router";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import { useSiteMeta } from "../../layout/siteMeta";
import { BarChart, neutralTone } from "./BarChart";
import { CollectionFailures } from "./CollectionFailures";
import { appPath, ATTENTION_PATH } from "./paths";
import { statusChanges } from "./insights";
import { STATUS_LABELS, forkRows, formatDay, isStatus, needingAttention, overviewStats, type OverviewStat } from "./rows";
import type { HistoryRow, UpdateRecord } from "./schemas";
import { useFleetViews } from "./useFleetViews";
import "./fleet.css";
import { useSignalVisibility } from "./visibility";

const HIDDEN_WHEN_ZERO = new Set(["unpromoted"]);

function visibleStat(stat: OverviewStat): boolean {
  return stat.count > 0 || !HIDDEN_WHEN_ZERO.has(stat.key);
}

function statusTone(stat: OverviewStat): string {
  return stat.key;
}

const CHANGES_SHOWN = 8;

function statusLabel(status: string): string {
  return isStatus(status) ? STATUS_LABELS[status] : status;
}

function RecentChanges({ history }: { history: readonly HistoryRow[] }) {
  const changes = statusChanges(history, CHANGES_SHOWN);
  if (changes.length === 0) return null;
  return (
    <section className="overview-section" aria-labelledby="changes-heading">
      <h2 id="changes-heading">Recent status changes</h2>
      <ul className="attention-list">
        {changes.map((change) => (
          <li key={`${change.date}-${change.repo}`} className="attention-row">
            <span>{formatDay(change.date)}</span>
            <Link to={appPath(change.repo)}>{change.repo}</Link>
            <span>
              {statusLabel(change.from)} → {statusLabel(change.to)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Updates({ updates }: { updates: readonly UpdateRecord[] }) {
  if (updates.length === 0) return null;
  return (
    <section className="overview-section" aria-labelledby="updates-heading">
      <h2 id="updates-heading">Updates</h2>
      <ul className="attention-list">
        {updates.map((update) => (
          <li key={`${update.date}-${update.title}`} className="attention-row">
            <span>{formatDay(update.date)}</span>
            {update.url ? (
              <a href={update.url} target="_blank" rel="noreferrer">
                {update.title}
              </a>
            ) : (
              <span>{update.title}</span>
            )}
            {update.repo && <Link to={appPath(update.repo)}>{update.repo}</Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AttentionLink({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p>
      <Link to={ATTENTION_PATH}>{`${count} ${count === 1 ? "fork needs" : "forks need"} attention`}</Link>
    </p>
  );
}

function Rollup() {
  const state = useFleetViews();
  const { isShown } = useSignalVisibility();
  if (state.status === "loading") return <Loading label="Loading fork status…" />;
  if (state.status === "error") return <ErrorState title="The fork status data could not be loaded." detail={state.message} />;
  const forks = forkRows(state.apps.records, state.drift.records);
  const stats = overviewStats(forks, state.apps.records.filter((app) => app.class === "original").length);
  const extras = stats.extras.filter((stat) => !stat.signal || isShown(stat.signal, "overview_tile"));
  return (
    <>
      <CollectionFailures failed={state.drift.failed} />
      <section className="overview-section" aria-labelledby="mix-heading">
        <h2 id="mix-heading">{`Status of our forks (${stats.total.count} tracked)`}</h2>
        <BarChart label="Forks by status" items={stats.statuses} tone={statusTone} />
        <AttentionLink count={needingAttention(forks).length} />
      </section>
      <section className="overview-section" aria-labelledby="signals-heading">
        <h2 id="signals-heading">Release and advisory signals</h2>
        <BarChart label="Release and advisory signals" items={[...extras, stats.originals].filter(visibleStat)} tone={neutralTone} />
      </section>
      <section className="overview-section" aria-labelledby="licences-heading">
        <h2 id="licences-heading">Licences</h2>
        <BarChart label="Forks by licence" items={stats.licences} tone={neutralTone} />
      </section>
      <RecentChanges history={state.history?.records ?? []} />
      <Updates updates={state.updates?.records ?? []} />
    </>
  );
}

export function FleetOverview() {
  usePageTitle("Overview");
  const { name, tagline } = useSiteMeta();
  return (
    <section className="page overview" aria-labelledby="page-title">
      <h1 id="page-title">{name}</h1>
      {tagline && <p className="caption overview__tagline">{tagline}</p>}
      <SiteFreshnessBanner />
      <Rollup />
    </section>
  );
}

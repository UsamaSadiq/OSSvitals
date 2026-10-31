import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { newIssueUrl } from "../../feedback/issueUrl";
import { usePageTitle } from "../../layout/pageTitle";
import { useSiteMeta } from "../../layout/siteMeta";
import { useTenant } from "../../tenants/context";
import type { FleetManifest } from "./schemas";
import { SIGNAL_CATALOGUE, type SignalEntry } from "./signals";
import { STATE_LABELS, editConfigUrl, failedCount, proposalYaml, settingsText, signalState, statusesUsing, surfacesText } from "./signalsPanel";
import { useFleetViews, type FleetViews } from "./useFleetViews";
import { useSignalVisibility } from "./visibility";
import "./fleet.css";

function Proposal({ info, collect }: { info: SignalEntry; collect: boolean }) {
  const { org } = useTenant();
  const sourceUrl = useSiteMeta().footer.sourceUrl;
  const yaml = proposalYaml(info.key, collect);
  if (!sourceUrl) return null;
  const title = `Turn ${info.label.toLowerCase()} ${collect ? "off" : "on"} for ${org}`;
  return (
    <details className="signal-row__proposal">
      <summary>{`Propose turning it ${collect ? "off" : "on"} for everyone`}</summary>
      <p className="caption">{`Add this to dashboard/config/${org}/fleet.yaml. The change applies after the next daily collection.`}</p>
      <pre className="detail-code">
        <code>{yaml}</code>
      </pre>
      <p>
        <a href={editConfigUrl(sourceUrl, org)} target="_blank" rel="noreferrer">
          Edit fleet.yaml on GitHub
        </a>
        {" · "}
        <a href={newIssueUrl(sourceUrl, "question", { tenant: org, title, details: yaml })} target="_blank" rel="noreferrer">
          Ask the maintainers instead
        </a>
      </p>
    </details>
  );
}

function SignalRow({ info, manifest, views }: { info: SignalEntry; manifest: FleetManifest; views: FleetViews }) {
  const { hiddenByViewer, setHiddenByViewer } = useSignalVisibility();
  const { key } = info;
  const signal = manifest.signals[key];
  const state = signalState(manifest, hiddenByViewer, key);
  const failed = signal?.collect ? failedCount(info, views.drift.records, views.conflicts) : 0;
  const settings = settingsText(signal?.settings ?? {});
  const statuses = statusesUsing(manifest.statuses, signal?.thresholds ?? []);
  const headingId = `signal-${key}`;
  const toggleable = state === "shown" || state === "hidden_by_viewer";
  return (
    <li className="signal-row" aria-labelledby={headingId}>
      <div className="signal-row__header">
        <h2 id={headingId}>{info.label}</h2>
        <span className={`signal-row__state signal-row__state--${state}`}>{STATE_LABELS[state]}</span>
      </div>
      <p>{info.description}</p>
      <dl className="signal-row__facts">
        {signal?.collect && (
          <>
            <dt>Shown on</dt>
            <dd>{signal.show.length > 0 ? surfacesText(signal.show) : "Nowhere; collected for statuses and the MCP server"}</dd>
          </>
        )}
        <dt>Collected</dt>
        <dd>{signal?.collect ? `${signal.cadence === "weekly" ? "Weekly" : "Daily"}` : "No"}</dd>
        {settings.length > 0 && (
          <>
            <dt>Settings</dt>
            <dd>{settings.join("; ")}</dd>
          </>
        )}
        {statuses.length > 0 && (
          <>
            <dt>Can decide status</dt>
            <dd>{statuses.join(", ")}</dd>
          </>
        )}
        {failed > 0 && (
          <>
            <dt>Latest run</dt>
            <dd>{`Collection failed for ${failed} ${failed === 1 ? "fork" : "forks"}`}</dd>
          </>
        )}
      </dl>
      {toggleable && (
        <label className="signal-row__toggle">
          <input type="checkbox" role="switch" checked={state === "shown"} onChange={(event) => setHiddenByViewer(key, !event.target.checked)} />
          Show in my view
        </label>
      )}
      <Proposal info={info} collect={Boolean(signal?.collect)} />
    </li>
  );
}

function Panel({ manifest, views }: { manifest: FleetManifest; views: FleetViews }) {
  const { hiddenByViewer, resetViewer } = useSignalVisibility();
  return (
    <>
      {hiddenByViewer.size > 0 && (
        <p>
          <button type="button" className="fork-filters__clear" onClick={resetViewer}>
            Show everything again
          </button>
        </p>
      )}
      <ul className="signal-list" aria-label="Signals">
        {SIGNAL_CATALOGUE.map((info) => (
          <SignalRow key={info.key} info={info} manifest={manifest} views={views} />
        ))}
      </ul>
    </>
  );
}

function Content() {
  const state = useFleetViews();
  if (state.status === "loading") return <Loading label="Loading signals…" />;
  if (state.status === "error") return <ErrorState title="The fork status data could not be loaded." detail={state.message} />;
  const manifest = state.meta?.fleet;
  if (!manifest) return <EmptyState kind="info" title="This dashboard's data was published before signals were listed." body="Every signal is shown. The list appears after the next daily collection." />;
  return <Panel manifest={manifest} views={state} />;
}

export function FleetSignals() {
  usePageTitle("Signals");
  return (
    <section className="page overview" aria-labelledby="page-title">
      <h1 id="page-title">Signals</h1>
      <p>
        Every signal this dashboard can track, whether it is collected, and where it shows. <strong>Show in my view</strong> hides a signal in
        this browser only and never changes a fork's status. To change what everyone sees, propose a change to this dashboard's settings.
      </p>
      <Content />
    </section>
  );
}

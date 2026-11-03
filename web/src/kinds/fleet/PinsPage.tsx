import { Link } from "react-router";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { usePageTitle } from "../../layout/pageTitle";
import { CollectionFailures } from "./CollectionFailures";
import { appPath } from "./paths";
import type { PinRecord } from "./schemas";
import { useFleetViews } from "./useFleetViews";
import "./fleet.css";

const CLASS_LABELS: Readonly<Record<PinRecord["class"], string>> = {
  fork: "Our fork",
  original: "Our project",
  dependency: "Third-party",
};

const STATUS_PILL: Readonly<Record<PinRecord["status"], { tone: string; label: string }>> = {
  current: { tone: "in-sync", label: "Current" },
  behind: { tone: "lagging", label: "Behind" },
  unknown: { tone: "unknown", label: "Unknown" },
};

const STATUS_ORDER: Readonly<Record<PinRecord["status"], number>> = { behind: 2, unknown: 1, current: 0 };

function plural(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

export function distanceText(pin: PinRecord): string {
  if (pin.latest_release === null) return "No release found";
  if (pin.releases_behind !== null && pin.releases_behind > 0) return `${plural(pin.releases_behind, "release")} behind ${pin.latest_release}`;
  if (pin.commits_behind !== null && pin.commits_behind > 0) return `${plural(pin.commits_behind, "commit")} behind ${pin.latest_release}`;
  if (pin.releases_behind === 0 || pin.commits_behind === 0) return `At ${pin.latest_release}`;
  return `Latest is ${pin.latest_release}`;
}

function RepoCell({ pin }: { pin: PinRecord }) {
  if (pin.class === "fork") return <Link to={appPath(pin.repo)}>{pin.repo}</Link>;
  return (
    <a href={`https://github.com/${pin.full_name}`} target="_blank" rel="noreferrer">
      {pin.full_name}
    </a>
  );
}

function PinCell({ pin }: { pin: PinRecord }) {
  return (
    <>
      <code>{pin.pin}</code> <span className="app-fact__note">{pin.pin_kind}</span>
      {pin.pin_note && <span className="app-fact__note">{pin.pin_note}</span>}
    </>
  );
}

const COLUMNS: Column<PinRecord>[] = [
  { key: "repo", header: "Repository", cell: (pin) => <RepoCell pin={pin} />, sortValue: (pin) => pin.full_name.toLowerCase() },
  { key: "class", header: "Kind", cell: (pin) => CLASS_LABELS[pin.class], sortValue: (pin) => CLASS_LABELS[pin.class] },
  {
    key: "status",
    header: "Status",
    cell: (pin) => <span className={`fork-status fork-status--${STATUS_PILL[pin.status].tone}`}>{STATUS_PILL[pin.status].label}</span>,
    sortValue: (pin) => STATUS_ORDER[pin.status],
    numeric: true,
  },
  { key: "pin", header: "Pinned in production", cell: (pin) => <PinCell pin={pin} />, sortValue: (pin) => pin.pin },
  {
    key: "distance",
    header: "Against the latest release",
    cell: distanceText,
    sortValue: (pin) => pin.releases_behind ?? pin.commits_behind ?? -1,
    numeric: true,
  },
];

function Content() {
  const state = useFleetViews();
  if (state.status === "loading") return <Loading label="Loading pins…" />;
  if (state.status === "error") return <ErrorState title="The fork status data could not be loaded." detail={state.message} />;
  if (!state.pins) return <EmptyState kind="info" title="No app has a production pin yet." />;
  return (
    <>
      <CollectionFailures failed={state.pins.failed} />
      <DataTable
        caption="Every pinned repository and how far its pin is behind the latest release"
        captionHidden
        columns={COLUMNS}
        rows={state.pins.records}
        rowKey={(pin) => pin.full_name}
        initialSort={{ key: "status", direction: "descending" }}
      />
    </>
  );
}

export function FleetPins() {
  usePageTitle("Pins");
  return (
    <section className="page overview" aria-labelledby="page-title">
      <h1 id="page-title">Pins</h1>
      <p className="caption">
        The ref each repository is installed at in production, as set in the tenant's config, against its newest release. Our own repos
        count our release tags; third-party repos count their own stable releases. A branch or commit pin is measured in commits.
      </p>
      <Content />
    </section>
  );
}

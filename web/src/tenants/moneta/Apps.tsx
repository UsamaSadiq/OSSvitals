import { Link, useSearchParams } from "react-router";
import { DataTable, type Column } from "../../components/DataTable";
import { DownloadButton } from "../../components/DownloadButton";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { Tabs, type TabItem } from "../../components/Tabs";
import { usePageTitle } from "../../layout/pageTitle";
import { FilterBar } from "./FilterBar";
import { ForkCards } from "./ForkCards";
import { StatusPill } from "./StatusPill";
import { forksCsv } from "./csv";
import { applyFilters, parseFilters } from "./filters";
import { appPath } from "./paths";
import { forkRows, formatDay, severity, sortedForks, type ForkRow } from "./rows";
import type { AppRecord } from "./schemas";
import { useMonetaViews } from "./useMonetaViews";
import "./moneta.css";

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

const FORK_COLUMNS: Column<ForkRow>[] = [
  {
    key: "app",
    header: "App",
    cell: ({ app }) => <Link to={appPath(app.repo)}>{app.repo}</Link>,
    sortValue: ({ app }) => app.repo.toLowerCase(),
  },
  {
    key: "status",
    header: "Status",
    cell: ({ drift }) => <StatusPill status={drift.status} />,
    sortValue: ({ drift }) => severity(drift.status),
    numeric: true,
  },
  {
    key: "behind",
    header: "Behind",
    cell: ({ drift }) => `${drift.behind_by.toLocaleString()} commits`,
    sortValue: ({ drift }) => drift.behind_by,
    numeric: true,
  },
  {
    key: "ahead",
    header: "Our patches",
    cell: ({ drift }) => `${drift.ahead_by.toLocaleString()} commits`,
    sortValue: ({ drift }) => drift.ahead_by,
    numeric: true,
  },
  {
    key: "synced",
    header: "Last sync",
    cell: ({ drift }) => `${formatDay(drift.last_upstream_merge)} (${drift.days_since_upstream_merge} days ago)`,
    sortValue: ({ drift }) => drift.days_since_upstream_merge,
    numeric: true,
  },
  {
    key: "release",
    header: "Our release",
    cell: ({ drift }) => (drift.fork_release ? `${drift.fork_release.tag} (${formatDay(drift.fork_release.date)})` : "none yet"),
    sortValue: ({ drift }) => drift.fork_release?.date ?? "",
  },
  {
    key: "upstream",
    header: "Upstream release",
    cell: ({ app, drift }) =>
      drift.upstream_release && app.upstream_url ? (
        <ExternalLink href={`${app.upstream_url}/releases`}>{drift.upstream_release.tag}</ExternalLink>
      ) : (
        "–"
      ),
  },
  {
    key: "advisories",
    header: "New advisories",
    cell: ({ drift }) => drift.advisories.since_fork_release,
    sortValue: ({ drift }) => drift.advisories.since_fork_release,
    numeric: true,
  },
  {
    key: "licence",
    header: "Licence",
    cell: ({ app }) => app.licence ?? "–",
    sortValue: ({ app }) => app.licence ?? "",
  },
];

const ORIGINAL_COLUMNS: Column<AppRecord>[] = [
  { key: "app", header: "App", cell: (app) => <ExternalLink href={app.url}>{app.repo}</ExternalLink>, sortValue: (app) => app.repo.toLowerCase() },
  { key: "description", header: "What it does", cell: (app) => app.description ?? "–" },
  { key: "pushed", header: "Last push", cell: (app) => formatDay(app.pushed_at), sortValue: (app) => app.pushed_at, numeric: true },
  { key: "release", header: "Latest release", cell: (app) => app.latest_tag ?? "none yet", sortValue: (app) => app.latest_tag ?? "" },
  { key: "open", header: "Open pull requests", cell: (app) => app.open_pull_requests ?? "–", sortValue: (app) => app.open_pull_requests ?? 0, numeric: true },
  { key: "licence", header: "Licence", cell: (app) => app.licence ?? "–", sortValue: (app) => app.licence ?? "" },
];

function Explainer() {
  return (
    <p className="caption">
      Each fork is compared with its upstream project on the branch we release from. Release means the newest stable tag we cut; it shows what
      source is published for each version, not what any particular server is running. New advisories are upstream advisories published on GitHub
      after our latest release.
    </p>
  );
}

function forkTabs(forks: readonly ForkRow[]): TabItem[] {
  return [
    { id: "cards", label: "Cards", content: () => <ForkCards rows={forks} /> },
    {
      id: "table",
      label: "Table",
      content: () => (
        <>
          <p className="fork-export">
            <DownloadButton label="Download CSV" filename="moneta-forks.csv" mimeType="text/csv" content={() => forksCsv(sortedForks(forks))} />
          </p>
          <DataTable
            caption="Forks and how far each has drifted from its upstream"
            captionHidden
            columns={FORK_COLUMNS}
            rows={sortedForks(forks)}
            rowKey={({ app }) => app.repo}
            initialSort={{ key: "status", direction: "descending" }}
            tieBreak={(a, b) => b.drift.behind_by - a.drift.behind_by}
          />
        </>
      ),
    },
  ];
}

function Forks({ forks }: { forks: readonly ForkRow[] }) {
  const [params] = useSearchParams();
  const shown = applyFilters(forks, parseFilters(params));
  return (
    <>
      <FilterBar rows={forks} shown={shown.length} />
      {shown.length === 0 ? <EmptyState kind="info" title="No forks match these filters." /> : <Tabs label="Fork view" tabs={forkTabs(shown)} />}
    </>
  );
}

function Content() {
  const state = useMonetaViews();
  if (state.status === "loading") return <Loading label="Loading fork status…" />;
  if (state.status === "error") return <ErrorState title="The fork status data could not be loaded." detail={state.message} />;
  const forks = forkRows(state.apps.records, state.drift.records);
  const originals = state.apps.records.filter((app) => app.class === "original");
  return (
    <>
      <Explainer />
      <section className="overview-section" aria-labelledby="forks-heading">
        <h2 id="forks-heading">Forks tracked against upstream</h2>
        <Forks forks={forks} />
      </section>
      <section className="overview-section" id="originals" aria-labelledby="originals-heading">
        <h2 id="originals-heading">Projects we build ourselves</h2>
        <DataTable
          caption="Original projects maintained in the organisation"
          captionHidden
          columns={ORIGINAL_COLUMNS}
          rows={originals}
          rowKey={(app) => app.repo}
          initialSort={{ key: "app", direction: "ascending" }}
        />
      </section>
    </>
  );
}

export function MonetaApps() {
  usePageTitle("Apps");
  return (
    <section className="page overview" aria-labelledby="page-title">
      <h1 id="page-title">Apps</h1>
      <Content />
    </section>
  );
}

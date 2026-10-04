import { CodeText } from "../../components/CodeText";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { KpiTile } from "../../components/KpiTile";
import { Loading } from "../../components/Loading";
import { QuerySelect, useQueryValue } from "../../components/QuerySelect";
import { ShareLink } from "../../components/ShareLink";
import type { ComponentsView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { formatNumber } from "../../format";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import { ComponentsTable, FindingReposTable, RelationsTable } from "./ComponentTables";
import {
  ALL,
  collectedLabel,
  declaredComponents,
  filterComponents,
  filterOptions,
  findingSuffix,
  RELEASE_OPTIONS,
  type ComponentRow,
  type FindingRow,
  type RelationRow,
  type Summary,
} from "./componentRows";
import "./componentsPage.css";

const BACKSTAGE_URL = "https://backstage.openedx.org/catalog";
const EMPTY_SUMMARY: Summary = { repos: 0, with_file: 0, with_problem: 0 };

function Intro() {
  return (
    <p>
      What each repository declares in its <code>catalog-info.yaml</code>: the same files{" "}
      <a href={BACKSTAGE_URL}>Backstage</a> reads, joined here with health grades, and checked for entries that are
      missing or half-filled.
    </p>
  );
}

function SummaryTiles({ summary }: { summary: Summary }) {
  return (
    <div className="components-summary">
      <KpiTile label="Repositories" value={formatNumber(summary.repos)} />
      <KpiTile
        label="With catalog-info.yaml"
        value={formatNumber(summary.with_file)}
        help={`${summary.repos - summary.with_file} have none.`}
      />
      <KpiTile label="With a problem to fix" value={formatNumber(summary.with_problem)} />
    </div>
  );
}

function FindingDetails({ finding }: { finding: FindingRow }) {
  return (
    <details className="components-finding">
      <summary>
        <strong>{finding.label}</strong>
        {findingSuffix(finding)}
      </summary>
      <FindingReposTable label={finding.label} repos={finding.repos} />
    </details>
  );
}

function CatalogIssues({ findings }: { findings: readonly FindingRow[] }) {
  return (
    <section className="components-section" aria-labelledby="catalog-issues-heading">
      <h2 id="catalog-issues-heading">Catalog issues</h2>
      {findings.length === 0 ? (
        <EmptyState kind="good" title="Every repository's catalog entry is complete." />
      ) : (
        <>
          <p className="caption">
            Problems stop Backstage or this dashboard from reading the entry correctly; notes are worth a look.
          </p>
          {findings.map((finding) => (
            <FindingDetails key={finding.code} finding={finding} />
          ))}
        </>
      )}
    </section>
  );
}

function DeclaredComponents({ components }: { components: readonly ComponentRow[] }) {
  const declared = declaredComponents(components);
  const typeOptions = filterOptions(declared.map((row) => row.type));
  const lifecycleOptions = filterOptions(declared.map((row) => row.lifecycle));
  const filters = {
    type: useQueryValue("type", typeOptions, ALL),
    lifecycle: useQueryValue("lifecycle", lifecycleOptions, ALL),
    release: useQueryValue("release", RELEASE_OPTIONS, ALL),
  };
  const shown = filterComponents(declared, filters);
  return (
    <section className="components-section" aria-labelledby="components-heading">
      <h2 id="components-heading">Components</h2>
      <div className="components-filters">
        <QuerySelect label="Type" param="type" options={typeOptions} defaultValue={ALL} />
        <QuerySelect label="Lifecycle" param="lifecycle" options={lifecycleOptions} defaultValue={ALL} />
        <QuerySelect label="Release" param="release" options={RELEASE_OPTIONS} defaultValue={ALL} />
      </div>
      <p className="caption">
        {shown.length} of {declared.length} declared components.
      </p>
      <ComponentsTable rows={shown} />
    </section>
  );
}

function DeclaredRelations({ relations }: { relations: readonly RelationRow[] }) {
  if (relations.length === 0) return null;
  return (
    <section className="components-section" aria-labelledby="relations-heading">
      <h2 id="relations-heading">Declared relations</h2>
      <p className="caption">
        <CodeText text="`dependsOn`, `subcomponentOf` and `dependencyOf`, checked against the entity names declared in the org." />
      </p>
      <RelationsTable rows={relations} />
    </section>
  );
}

function CatalogSnapshot({ view }: { view: ComponentsView }) {
  return (
    <>
      <p className="caption">
        Collected {collectedLabel(view.collected_at)} from each repo's default branch. User owners are checked against
        GitHub; group owners are not, since that needs openedx org membership.
      </p>
      <SummaryTiles summary={view.summary ?? EMPTY_SUMMARY} />
      <CatalogIssues findings={view.findings ?? []} />
      <DeclaredComponents components={view.components ?? []} />
      <DeclaredRelations relations={view.relations ?? []} />
    </>
  );
}

function NoSnapshot() {
  return (
    <EmptyState
      kind="info"
      title="No catalog snapshot yet."
      body="It is published daily by the collect-maintenance workflow; check back after its next run."
    />
  );
}

function ComponentsContent() {
  const components = useView("components");
  if (components.status === "loading") return <Loading label="Loading catalog snapshot…" />;
  if (components.status === "error") {
    return <ErrorState title="The catalog data could not be loaded." detail={components.error.message} />;
  }
  if (!components.data.available) return <NoSnapshot />;
  return (
    <>
      <CatalogSnapshot view={components.data} />
      <ShareLink />
    </>
  );
}

export function Components() {
  usePageTitle("Components");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">Components</h1>
      <SiteFreshnessBanner />
      <Intro />
      <ComponentsContent />
    </section>
  );
}

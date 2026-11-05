import { ChartFigure } from "../../components/ChartFigure";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { KpiTile } from "../../components/KpiTile";
import { Loading } from "../../components/Loading";
import { ShareLink } from "../../components/ShareLink";
import type { Modularization, PlatformTrends, PlatformView, TrendOrganisation, TrendYear } from "../../data/schemas";
import { useView } from "../../data/useView";
import { formatNumber, formatUtcDate } from "../../format";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import {
  barChart,
  change,
  changeSince,
  changeText,
  monthLabel,
  organisationName,
  pinRows,
  seriesChart,
  setAside,
  yearBars,
  yearLabel,
  type PinRow,
} from "./platformRows";
import "./platform.css";

type Block = NonNullable<Modularization["blocks"]>[number];

const BLOCK_STATUS_LABELS: Record<Block["status"], string> = {
  extracted: "Extracted",
  built_in: "Still built in",
};

function Intro() {
  return (
    <p>
      How the Open edX core, <code>openedx-platform</code>, is changing: which parts have moved out into separately
      released packages, how much legacy code is left, and how much the code still changes. Every number is read from
      the platform&rsquo;s public source and git history on GitHub by a scheduled job.
    </p>
  );
}

function collectedText(collectedAt: string | null | undefined): string {
  return collectedAt ? `Collected ${formatUtcDate(collectedAt)}` : "Collection time unknown";
}

const BLOCK_COLUMNS: Column<Block>[] = [
  { key: "block", header: "XBlock", cell: (row) => row.block, sortValue: (row) => row.block },
  {
    key: "status",
    header: "Status",
    cell: (row) => <span className={`pf-chip pf-chip--${row.status}`}>{BLOCK_STATUS_LABELS[row.status]}</span>,
    sortValue: (row) => row.status,
  },
  { key: "toggle", header: "Setting", cell: (row) => <code>{`USE_EXTRACTED_${row.toggle}_BLOCK`}</code> },
];

const PIN_COLUMNS: Column<PinRow>[] = [
  { key: "name", header: "Package", cell: (row) => row.name, sortValue: (row) => row.name },
  { key: "version", header: "Pinned version", cell: (row) => row.version ?? "Not pinned" },
];

function ModularizationTiles({ section }: { section: Modularization }) {
  const history = section.legacy_frontend?.history ?? [];
  const latest = history[history.length - 1];
  const legacyChange = changeText(change(history));
  return (
    <div className="pf-summary">
      <KpiTile
        label="Built-in XBlocks extracted"
        value={`${formatNumber(section.summary?.extracted ?? 0)} of ${formatNumber(section.summary?.blocks ?? 0)}`}
        help={`Core XBlocks whose code now ships in ${section.extracted_package ?? "a separate package"} instead of the platform.`}
      />
      <KpiTile
        label="Legacy frontend files"
        value={latest ? formatNumber(latest.count) : "Unknown"}
        delta={legacyChange ? { text: legacyChange, direction: "flat", tone: "neutral" } : null}
        help="JavaScript, Underscore, HTML and Sass files still inside the platform's lms, cms, common, xmodule and openedx folders, excluding tests. New screens are built as separate frontend apps."
      />
    </div>
  );
}

function ModularizationSection({ section }: { section: Modularization }) {
  const history = section.legacy_frontend?.history ?? [];
  const chart = seriesChart(history, "legacy frontend files", "Files");
  return (
    <section className="pf-section" id="modularization" aria-labelledby="pf-modularization-heading">
      <h2 id="pf-modularization-heading">Modularization</h2>
      {!section.available ? (
        <EmptyState kind="info" title="Not collected yet." body="Published daily by the collect-maintenance workflow." />
      ) : (
        <>
          <p className="caption">
            {collectedText(section.collected_at)} from <code>{section.repo}</code> at <code>{section.ref}</code>.{" "}
            {section.toggles_url && (
              <>
                XBlock settings from <a href={section.toggles_url}>openedx/envs/common.py</a>.{" "}
              </>
            )}
            {section.pins_url && (
              <>
                Versions from <a href={section.pins_url}>requirements/edx/base.txt</a>.
              </>
            )}
          </p>
          <ModularizationTiles section={section} />
          {chart && (
            <>
              <h3>Legacy frontend files in the platform, 1 January each year</h3>
              <ChartFigure chart={chart} />
            </>
          )}
          <div className="pf-columns">
            <div>
              <h3>Core XBlocks</h3>
              <DataTable
                caption="Core XBlocks"
                captionHidden
                columns={BLOCK_COLUMNS}
                rows={section.blocks ?? []}
                rowKey={(row) => row.toggle}
                emptyMessage="No XBlock settings found."
              />
            </div>
            <div>
              <h3>Extracted packages the platform pins</h3>
              <DataTable
                caption="Extracted packages"
                captionHidden
                columns={PIN_COLUMNS}
                rows={pinRows(section.pins)}
                rowKey={(row) => row.name}
                emptyMessage="No pins found."
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function count(value: number | null | undefined): string {
  return value == null ? "Unknown" : formatNumber(value);
}

function numericColumn<Row>(key: string, header: string, pick: (row: Row) => number | null): Column<Row> {
  return { key, header, numeric: true, cell: (row) => count(pick(row)), sortValue: (row) => pick(row) ?? -1 };
}

const YEAR_COLUMNS: Column<TrendYear>[] = [
  { key: "year", header: "Year", cell: (row) => yearLabel(row), sortValue: (row) => row.year },
  numericColumn("commits", "Commits", (row) => row.commits),
  numericColumn("authors", "Authors", (row) => row.authors),
  numericColumn("python_added", "Python lines added", (row) => row.python_added),
  numericColumn("python_deleted", "Python lines removed", (row) => row.python_deleted),
  numericColumn("python_lines", "Python lines at the end", (row) => row.python_lines),
];

const ORGANISATION_COLUMNS: Column<TrendOrganisation>[] = [
  { key: "name", header: "Email domain", cell: (row) => organisationName(row), sortValue: (row) => row.name },
  numericColumn("authors", "Authors", (row) => row.authors),
  numericColumn("commits", "Commits", (row) => row.commits),
];

function neutral(text: string | null) {
  return text ? { text, direction: "flat" as const, tone: "neutral" as const } : null;
}

function TrendTiles({ section }: { section: PlatformTrends }) {
  const { first, latest, first_year: firstYear, latest_year: latestYear } = section.summary ?? {};
  const now = section.years?.[section.years.length - 1];
  return (
    <div className="pf-summary">
      <KpiTile
        label={latestYear ? `Commits in ${latestYear}` : "Commits"}
        value={count(latest?.commits)}
        delta={neutral(changeSince(first?.commits, latest?.commits, firstYear))}
        help="Commits that landed on the main branch in the year, leaving out merge commits, bot commits and mechanical sweeps."
      />
      <KpiTile
        label={latestYear ? `Authors in ${latestYear}` : "Authors"}
        value={count(latest?.authors)}
        delta={neutral(changeSince(first?.authors, latest?.authors, firstYear))}
        help="Distinct author email addresses behind those commits. Someone who used two addresses counts twice."
      />
      <KpiTile
        label="Python lines"
        value={count(now?.python_lines)}
        delta={neutral(changeSince(first?.python_lines, now?.python_lines, firstYear))}
        help="Lines in the platform's Python files at the end of the latest month, leaving out tests and database migrations."
      />
    </div>
  );
}

function trendsCaption(section: PlatformTrends): string {
  const { bots, mechanical } = setAside(section.years ?? []);
  const range = section.since && section.through ? `${monthLabel(section.since)} to ${monthLabel(section.through)}` : "";
  const sweeps = section.mechanical_max_files
    ? `changes to more than ${formatNumber(section.mechanical_max_files)} files or lint-only changes`
    : "mechanical sweeps";
  return `${range}. Left out: merge commits, ${formatNumber(bots)} bot commits and ${formatNumber(mechanical)} ${sweeps}.`;
}

function TrendsSection({ section }: { section: PlatformTrends }) {
  const years = section.years ?? [];
  const complete = years.filter((year) => year.complete);
  const latest = complete[complete.length - 1];
  const commits = barChart(yearBars(complete, (year) => year.commits, "commits"), "Commits");
  const lines = barChart(yearBars(years, (year) => year.python_lines, "Python lines"), "Lines");
  return (
    <section className="pf-section" id="stability" aria-labelledby="pf-stability-heading">
      <h2 id="pf-stability-heading">Stability</h2>
      {!section.available ? (
        <EmptyState kind="info" title="Not collected yet." body="Published monthly by the collect-maintenance workflow." />
      ) : (
        <>
          <p className="caption">
            {collectedText(section.collected_at)} from the git history of <code>{section.repo}</code> at{" "}
            <code>{section.ref}</code>, {trendsCaption(section)}
          </p>
          <TrendTiles section={section} />
          {commits && (
            <>
              <h3>Commits per year</h3>
              <ChartFigure chart={commits} />
            </>
          )}
          {lines && (
            <>
              <h3>Python lines at the end of each year</h3>
              <ChartFigure chart={lines} />
            </>
          )}
          <h3>By year</h3>
          <DataTable
            caption="Platform activity by year"
            captionHidden
            columns={YEAR_COLUMNS}
            rows={years}
            rowKey={(row) => String(row.year)}
            emptyMessage="No years collected."
          />
          {latest && (
            <>
              <h3>Contributor organisations in {latest.year}</h3>
              <p className="caption">
                By author email domain. A domain with a single author is counted under other domains, so no one is
                named.
              </p>
              <DataTable
                caption={`Contributor organisations in ${latest.year}`}
                captionHidden
                columns={ORGANISATION_COLUMNS}
                rows={latest.organisations}
                rowKey={(row) => `${row.kind}:${row.name}`}
                emptyMessage="No authors that year."
              />
            </>
          )}
        </>
      )}
    </section>
  );
}

function Sections({ view }: { view: PlatformView }) {
  return (
    <>
      <ModularizationSection section={view.modularization} />
      {view.trends && <TrendsSection section={view.trends} />}
    </>
  );
}

function PlatformContent() {
  const platform = useView("platform");
  if (platform.status === "loading") return <Loading label="Loading platform facts…" />;
  if (platform.status === "error") {
    return <ErrorState title="The platform data could not be loaded." detail={platform.error.message} />;
  }
  if (!platform.data.available) {
    return (
      <EmptyState
        kind="info"
        title="No platform snapshot yet."
        body="It is published daily by the collect-maintenance workflow; check back after its next run."
      />
    );
  }
  return (
    <>
      <Sections view={platform.data} />
      <ShareLink />
    </>
  );
}

export function Platform() {
  usePageTitle("Platform");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">Platform</h1>
      <SiteFreshnessBanner />
      <Intro />
      <PlatformContent />
    </section>
  );
}

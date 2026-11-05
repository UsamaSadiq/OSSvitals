import { useEffect, type ReactNode } from "react";
import { Badge, type BadgeTone } from "../../components/Badge";
import { ChartFigure } from "../../components/ChartFigure";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { KpiTile } from "../../components/KpiTile";
import { Loading } from "../../components/Loading";
import type {
  ExtensionPoints,
  ExtensionRelease,
  Modularization,
  PlatformTrends,
  PlatformView,
  TrendOrganisation,
  TrendYear,
  UpgradeCost,
  UpgradeRelease,
} from "../../data/schemas";
import { useView } from "../../data/useView";
import { formatCount, formatNumber, formatUtcDate } from "../../format";
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
  releaseBars,
  releaseLabel,
  seriesChart,
  setAside,
  yearBars,
  yearLabel,
  type PinRow,
} from "./platformRows";
import { briefPoints, type BriefPoint, type Verdict } from "./platformBrief";
import "./platform.css";

type Block = NonNullable<Modularization["blocks"]>[number];
type FirstAndNow = NonNullable<ExtensionPoints["summary"]>["filters"];

const BLOCK_STATUS_LABELS: Record<Block["status"], string> = {
  extracted: "Extracted",
  built_in: "Still built in",
};

function Intro() {
  return (
    <p className="page-lede">
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
    cell: (row) => <Badge tone={row.status === "extracted" ? "good" : "warn"}>{BLOCK_STATUS_LABELS[row.status]}</Badge>,
    sortValue: (row) => row.status,
  },
  { key: "toggle", header: "Setting", cell: (row) => <code>{`USE_EXTRACTED_${row.toggle}_BLOCK`}</code> },
];

const PIN_COLUMNS: Column<PinRow>[] = [
  { key: "name", header: "Package", cell: (row) => row.name, sortValue: (row) => row.name },
  { key: "version", header: "Pinned version", cell: (row) => row.version ?? "Not pinned" },
];

function Sources({ children }: { children: ReactNode }) {
  return (
    <details className="pf-sources">
      <summary>Sources and method</summary>
      <p className="caption">{children}</p>
    </details>
  );
}

function ShowData({ children }: { children: ReactNode }) {
  return (
    <details className="pf-data">
      <summary>Show data</summary>
      {children}
    </details>
  );
}

/** The status column says nothing when every block has the same status, so the count carries it instead. */
function BlocksTable({ blocks }: { blocks: readonly Block[] }) {
  const extracted = blocks.filter((block) => block.status === "extracted").length;
  const uniform = extracted === 0 || extracted === blocks.length;
  return (
    <DataTable
      caption="Core XBlocks"
      count={`${formatNumber(extracted)} of ${formatCount(blocks.length, "block")} extracted`}
      columns={uniform ? BLOCK_COLUMNS.filter((column) => column.key !== "status") : BLOCK_COLUMNS}
      rows={blocks}
      rowKey={(row) => row.toggle}
      emptyMessage="No XBlock settings found."
    />
  );
}

/** Fewer legacy files, more extension points and fewer open deprecations are good news; colour says so. */
function deltaFor(text: string | null, percent: number | null, lowerIsBetter: boolean) {
  if (!text || percent === null || percent === 0) return null;
  const improved = percent < 0 === lowerIsBetter;
  return { text, direction: percent < 0 ? ("down" as const) : ("up" as const), tone: improved ? ("good" as const) : ("bad" as const) };
}

function ModularizationTiles({ section }: { section: Modularization }) {
  const history = section.legacy_frontend?.history ?? [];
  const latest = history[history.length - 1];
  const legacyDelta = change(history);
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
        delta={deltaFor(changeText(legacyDelta), legacyDelta?.percent ?? null, true)}
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
          <ModularizationTiles section={section} />
          {chart && (
            <>
              <h3>Legacy frontend files in the platform, 1 January each year</h3>
              <ChartFigure chart={chart} />
            </>
          )}
          <div className="pf-columns">
            <div>
              <BlocksTable blocks={section.blocks ?? []} />
            </div>
            <div>
              <DataTable
                caption="Extracted packages the platform pins"
                columns={PIN_COLUMNS}
                rows={pinRows(section.pins)}
                rowKey={(row) => row.name}
                emptyMessage="No pins found."
              />
            </div>
          </div>
          <Sources>
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
          </Sources>
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
          <ShowData>
            <DataTable
              caption="Platform activity by year"
              count={formatCount(years.length, "year")}
              columns={YEAR_COLUMNS}
              rows={years}
              rowKey={(row) => String(row.year)}
              emptyMessage="No years collected."
            />
          </ShowData>
          {latest && (
            <DataTable
              caption={`Contributor organisations in ${latest.year}`}
              description="By author email domain. A domain with a single author is counted under other domains, so no one is named."
              columns={ORGANISATION_COLUMNS}
              rows={latest.organisations}
              rowKey={(row) => `${row.kind}:${row.name}`}
              emptyMessage="No authors that year."
            />
          )}
          <Sources>
            {collectedText(section.collected_at)} from the git history of <code>{section.repo}</code> at{" "}
            <code>{section.ref}</code>, {trendsCaption(section)}
          </Sources>
        </>
      )}
    </section>
  );
}

function packageCell(entry: ExtensionRelease["filters"]) {
  if (entry.version === null) return "Not pinned";
  return `${count(entry.count)} (${entry.version})`;
}

const RELEASE_COLUMNS: Column<ExtensionRelease>[] = [
  {
    key: "release",
    header: "Release",
    cell: (row) => `${releaseLabel(row.release)} (${row.date})`,
    sortValue: (row) => row.date,
  },
  { key: "filters", header: "Filters (version)", cell: (row) => packageCell(row.filters), sortValue: (row) => row.filters.count ?? -1 },
  { key: "events", header: "Events (version)", cell: (row) => packageCell(row.events), sortValue: (row) => row.events.count ?? -1 },
  numericColumn("plugin_slots", "Plugin slots", (row) => row.plugin_slots.total),
  numericColumn("apps", "Apps with slots", (row) => Object.keys(row.plugin_slots.repos).length),
];

function growth(entry: FirstAndNow | undefined): number | null {
  const from = entry?.first?.count;
  const to = entry?.now;
  return from && to != null ? (100 * (to - from)) / from : null;
}

function ExtensionTile({ label, entry, help }: { label: string; entry: FirstAndNow | undefined; help: string }) {
  const since = entry?.first ? releaseLabel(entry.first.release) : undefined;
  return (
    <KpiTile
      label={label}
      value={count(entry?.now)}
      delta={deltaFor(changeSince(entry?.first?.count, entry?.now, since), growth(entry), false)}
      help={help}
    />
  );
}

function ExtensionPointsSection({ section }: { section: ExtensionPoints }) {
  const releases = section.releases ?? [];
  const slots = barChart(
    releaseBars(releases, (row) => row.plugin_slots.total || null, "plugin slots"),
    "Slots",
  );
  const roots = (section.slots_roots ?? []).map((root, index) => (
    <span key={root}>
      {index > 0 && " or "}
      <code>{root}</code>
    </span>
  ));
  return (
    <section className="pf-section" id="extension-points" aria-labelledby="pf-extension-heading">
      <h2 id="pf-extension-heading">Extension points</h2>
      {!section.available ? (
        <EmptyState kind="info" title="Not collected yet." body="Published daily by the collect-maintenance workflow." />
      ) : (
        <>
          <p className="pf-section__lede">
            Ways to change the platform without forking it, at each named release and on the main branches now.
          </p>
          <div className="pf-summary">
            <ExtensionTile
              label="Filters"
              entry={section.summary?.filters}
              help="Hooks a plugin can use to change what the platform does, such as blocking an enrollment or changing a page's context."
            />
            <ExtensionTile
              label="Events"
              entry={section.summary?.events}
              help="Signals the platform sends when something happens, such as an enrollment or a course publish, for plugins and other services to act on."
            />
            <ExtensionTile
              label="Plugin slots"
              entry={section.summary?.plugin_slots}
              help="Places in the frontend apps where an operator can insert, replace or hide a component through configuration."
            />
          </div>
          {slots && (
            <>
              <h3>Plugin slots in the frontend apps per release</h3>
              <ChartFigure chart={slots} />
            </>
          )}
          <ShowData>
            <DataTable
              caption="Extension points by release"
              count={formatCount(releases.length, "release")}
              columns={RELEASE_COLUMNS}
              rows={releases}
              rowKey={(row) => row.release}
              emptyMessage="No releases collected."
            />
          </ShowData>
          <Sources>
            {collectedText(section.collected_at)}, at each named release&rsquo;s <code>.1</code> tag and on the main
            branches now. Filters and events are counted in the{" "}
            <code>{section.packages?.filters ?? "openedx-filters"}</code> and{" "}
            <code>{section.packages?.events ?? "openedx-events"}</code> versions the platform pins. Plugin slots are
            folders named <code>…Slot</code>, at any depth, under {roots.length > 0 ? roots : "the slot folders"} in each{" "}
            <code>frontend-app-*</code> repository at the same tag.
          </Sources>
        </>
      )}
    </section>
  );
}

function daysText(days: number | null | undefined): string {
  return days == null ? "Unknown" : `${formatNumber(days)} days`;
}

const UPGRADE_COLUMNS: Column<UpgradeRelease>[] = [
  {
    key: "release",
    header: "Release",
    cell: (row) => `${releaseLabel(row.release)} (${row.date ?? "not cut yet"})`,
    sortValue: (row) => row.date ?? "9999",
  },
  numericColumn("days", "Days since the previous release", (row) => row.days_since_previous),
  numericColumn("deprecations", "Deprecations", (row) => row.deprecations.total),
  numericColumn("open", "Still open", (row) => row.deprecations.open),
  {
    key: "breaking",
    header: "Breaking changes",
    numeric: true,
    cell: (row) =>
      row.notes_url ? <a href={row.notes_url}>{count(row.breaking_changes)}</a> : count(row.breaking_changes),
    sortValue: (row) => row.breaking_changes ?? -1,
  },
];

function otherTickets(section: UpgradeCost): string {
  const parts = [
    section.earlier?.total ? `${formatNumber(section.earlier.total)} name an earlier release` : null,
    section.withdrawn?.total ? `${formatNumber(section.withdrawn.total)} were withdrawn and are not counted` : null,
  ].filter(Boolean);
  return parts.length ? `; ${parts.join(", ")}` : "";
}

function UpgradeCostSection({ section }: { section: UpgradeCost }) {
  const releases = section.releases ?? [];
  const deprecations = barChart(
    releaseBars(releases, (row) => row.deprecations.total, "deprecations"),
    "Deprecations",
  );
  return (
    <section className="pf-section" id="upgrade-cost" aria-labelledby="pf-upgrade-heading">
      <h2 id="pf-upgrade-heading">Upgrade cost</h2>
      {!section.available ? (
        <EmptyState kind="info" title="Not collected yet." body="Published daily by the collect-maintenance workflow." />
      ) : (
        <>
          <p className="pf-section__lede">What each named release removes or changes for operators.</p>
          <div className="pf-summary">
            <KpiTile
              label="Time between releases"
              value={daysText(section.summary?.median_days_between)}
              help="Median days between consecutive named releases, from the date of each release's .1 tag."
            />
            <KpiTile
              label="Open deprecations"
              value={count(section.summary?.open_deprecations)}
              tone={(section.summary?.open_deprecations ?? 0) > 0 ? "warn" : undefined}
              help="DEPR tickets still open, whether or not they name a release. Each one is a removal operators will need to plan for."
            />
            <KpiTile
              label="Deprecations with a release"
              value={count(section.summary?.deprecations)}
              help="DEPR tickets that name the release they land in, across the releases shown."
            />
          </div>
          {deprecations && (
            <>
              <h3>Deprecations landing in each release</h3>
              <ChartFigure chart={deprecations} />
            </>
          )}
          <ShowData>
            <DataTable
              caption="Upgrade cost by release"
              count={formatCount(releases.length, "release")}
              columns={UPGRADE_COLUMNS}
              rows={releases}
              rowKey={(row) => row.release}
              emptyMessage="No releases collected."
            />
          </ShowData>
          <Sources>
            {collectedText(section.collected_at)}. Deprecations are the{" "}
            {section.deprecations_url ? <a href={section.deprecations_url}>DEPR tickets</a> : "DEPR tickets"} whose
            form names that release as the first one without the deprecated functionality;{" "}
            {formatNumber(section.unscheduled?.total ?? 0)} name no release yet ({formatNumber(section.unscheduled?.open ?? 0)}{" "}
            of them open){otherTickets(section)}. Breaking changes are the changes listed under Breaking Changes in each
            release&rsquo;s developer and operator notes.
          </Sources>
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
      {view.extension_points && <ExtensionPointsSection section={view.extension_points} />}
      {view.upgrade_cost && <UpgradeCostSection section={view.upgrade_cost} />}
    </>
  );
}

const VERDICT_BADGES: Record<Verdict, { tone: BadgeTone; label: string }> = {
  good: { tone: "good", label: "On track" },
  watch: { tone: "warn", label: "Watch" },
  concern: { tone: "fail", label: "Concern" },
};

function BriefCard({ point }: { point: BriefPoint }) {
  const verdict = point.headline ? VERDICT_BADGES[point.headline.verdict] : null;
  return (
    <li className="pf-brief__card">
      <div className="pf-brief__top">
        <h3 className="pf-brief__topic">{point.topic}</h3>
        {verdict && <Badge tone={verdict.tone}>{verdict.label}</Badge>}
      </div>
      {point.headline && (
        <p className="pf-brief__figure">
          <span className="pf-brief__number">{point.headline.figure}</span> {point.headline.label}
        </p>
      )}
      <p className="pf-brief__text">{point.text}</p>
      <a className="pf-brief__more" href={point.href}>
        Details<span className="visually-hidden"> on {point.topic.toLowerCase()}</span>
      </a>
    </li>
  );
}

function Brief({ view }: { view: PlatformView }) {
  const points = briefPoints(view);
  if (points.length === 0) return null;
  return (
    <section className="pf-section pf-brief" id="brief" aria-labelledby="pf-brief-heading">
      <h2 id="pf-brief-heading">In brief</h2>
      <ul className="pf-brief__cards">
        {points.map((point) => (
          <BriefCard key={point.topic} point={point} />
        ))}
      </ul>
    </section>
  );
}

function sectionLinks(view: PlatformView): { href: string; label: string }[] {
  return [
    { href: "#modularization", label: "Modularization", shown: true },
    { href: "#stability", label: "Stability", shown: Boolean(view.trends) },
    { href: "#extension-points", label: "Extension points", shown: Boolean(view.extension_points) },
    { href: "#upgrade-cost", label: "Upgrade cost", shown: Boolean(view.upgrade_cost) },
  ].filter((link) => link.shown);
}

/** Collapsed sources and data tables open for printing, so a printed page is the whole report. */
function useOpenDetailsForPrint() {
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const open = () => {
      opened = [...document.querySelectorAll<HTMLDetailsElement>(".pf-sources:not([open]), .pf-data:not([open])")];
      opened.forEach((element) => element.setAttribute("open", ""));
    };
    const restore = () => opened.forEach((element) => element.removeAttribute("open"));
    window.addEventListener("beforeprint", open);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", open);
      window.removeEventListener("afterprint", restore);
    };
  }, []);
}

function SectionLinks({ view }: { view: PlatformView }) {
  useOpenDetailsForPrint();
  return (
    <nav className="pf-nav" aria-label="Sections on this page">
      <ul>
        {sectionLinks(view).map((link) => (
          <li key={link.href}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))}
      </ul>
    </nav>
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
      <SectionLinks view={platform.data} />
      <Brief view={platform.data} />
      <Sections view={platform.data} />
    </>
  );
}

export function Platform() {
  usePageTitle("Platform");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">Platform</h1>
      <Intro />
      <SiteFreshnessBanner />
      <PlatformContent />
    </section>
  );
}

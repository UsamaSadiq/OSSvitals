import { ChartFigure } from "../../components/ChartFigure";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { KpiTile } from "../../components/KpiTile";
import { Loading } from "../../components/Loading";
import { ShareLink } from "../../components/ShareLink";
import type { Modularization, PlatformView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { formatNumber, formatUtcDate } from "../../format";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import { change, changeText, pinRows, seriesChart, type PinRow } from "./platformRows";
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
      released packages and how much legacy code is left. Every number is read from the platform&rsquo;s public source
      on GitHub by a daily job.
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

function Sections({ view }: { view: PlatformView }) {
  return <ModularizationSection section={view.modularization} />;
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

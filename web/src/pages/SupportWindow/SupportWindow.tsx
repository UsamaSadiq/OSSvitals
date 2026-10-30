import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { KpiTile } from "../../components/KpiTile";
import { Loading } from "../../components/Loading";
import { ShareLink } from "../../components/ShareLink";
import type { SupportProduct, SupportWindowView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { formatNumber, formatUtcDate } from "../../format";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import {
  byStatus,
  declaredText,
  drifted,
  monthLabel,
  snapshotDay,
  sourcesText,
  STATUS_LABELS,
  STATUS_ORDER,
  timeRange,
} from "./supportRows";
import { Timeline } from "./Timeline";
import "./supportWindow.css";

const TILE_STATUSES = STATUS_ORDER.filter((status) => status !== "unknown");

function Intro() {
  return (
    <p>
      The OEP-10 support calendar, kept current from endoflife.date. <strong>In use</strong> is what the latest Tutor
      release ships; <strong>declared</strong> is the <code>CURRENT</code> list in repo-tools{" "}
      <code>barcalendar.py</code>. When they disagree, the calendar needs a pull request.
    </p>
  );
}

function StatusChip({ product }: { product: SupportProduct }) {
  return <span className={`sw-chip sw-chip--${product.status}`}>{STATUS_LABELS[product.status]}</span>;
}

function InUse({ product }: { product: SupportProduct }) {
  if (!product.detected) return <>Unknown</>;
  return product.detected_url ? <a href={product.detected_url}>{product.detected}</a> : <>{product.detected}</>;
}

const COLUMNS: Column<SupportProduct>[] = [
  { key: "label", header: "Product", cell: (row) => <a href={row.source_note}>{row.label}</a>, sortValue: (row) => row.label },
  {
    key: "status",
    header: "Status",
    cell: (row) => <StatusChip product={row} />,
    sortValue: (row) => STATUS_ORDER.indexOf(row.status),
  },
  { key: "declared", header: "Declared", cell: declaredText, sortValue: declaredText },
  { key: "detected", header: "In use", cell: (row) => <InUse product={row} />, sortValue: (row) => row.detected ?? "" },
  {
    key: "current_end",
    header: "End of life",
    cell: (row) => monthLabel(row.current_end),
    sortValue: (row) => row.current_end ?? "9999",
  },
  { key: "reason", header: "Why", cell: (row) => <span className="sw-why">{row.reason}</span> },
];

function SummaryTiles({ summary }: { summary: Record<string, number> }) {
  return (
    <div className="sw-summary">
      {TILE_STATUSES.map((status) => (
        <KpiTile key={status} label={STATUS_LABELS[status]} value={formatNumber(summary[status] ?? 0)} />
      ))}
    </div>
  );
}

function DriftNotice({ products, editUrl }: { products: readonly SupportProduct[]; editUrl: string | null | undefined }) {
  if (products.length === 0) {
    return <EmptyState kind="good" title="barcalendar.py matches what Tutor ships." />;
  }
  return (
    <EmptyState
      kind="warn"
      title={`barcalendar.py needs a pull request for ${products.map((product) => product.label).join(", ")}.`}
      body={products.map((product) => `${product.reason}.`).join(" ")}
      action={editUrl ? { label: "Edit barcalendar.py", href: editUrl } : undefined}
    />
  );
}

function Snapshot({ view }: { view: SupportWindowView }) {
  const products = view.products ?? [];
  const today = snapshotDay(view);
  return (
    <>
      <p className="caption">
        Collected {view.collected_at ? formatUtcDate(view.collected_at) : "at an unknown time"} from{" "}
        {sourcesText(view.refs)}.{" "}
        {view.declared_url && (
          <>
            Declared versions from <a href={view.declared_url}>barcalendar.py</a>.
          </>
        )}
      </p>
      <SummaryTiles summary={view.summary ?? {}} />
      <DriftNotice products={drifted(products)} editUrl={view.edit_url} />
      <section className="sw-section" aria-labelledby="sw-products-heading">
        <h2 id="sw-products-heading">Products</h2>
        <DataTable
          caption="Products"
          captionHidden
          columns={COLUMNS}
          rows={byStatus(products)}
          rowKey={(row) => row.product}
          emptyMessage="No products collected."
        />
      </section>
      <section className="sw-section" aria-labelledby="sw-calendar-heading">
        <h2 id="sw-calendar-heading">Calendar</h2>
        <p className="caption">
          Each bar runs from release to end of life; the outlined bar is the version in use and the vertical line is
          today. Faded bars have no published end date.
        </p>
        <Timeline products={products} range={timeRange(view.window, today)} today={today} />
      </section>
    </>
  );
}

function NoSnapshot() {
  return (
    <EmptyState
      kind="info"
      title="No support window snapshot yet."
      body="It is published daily by the collect-maintenance workflow; check back after its next run."
    />
  );
}

function SupportWindowContent() {
  const support = useView("support_window");
  if (support.status === "loading") return <Loading label="Loading support windows…" />;
  if (support.status === "error") {
    return <ErrorState title="The support window data could not be loaded." detail={support.error.message} />;
  }
  if (!support.data.available) return <NoSnapshot />;
  return (
    <>
      <Snapshot view={support.data} />
      <ShareLink />
    </>
  );
}

export function SupportWindow() {
  usePageTitle("Support Window");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">Support Window</h1>
      <SiteFreshnessBanner />
      <Intro />
      <SupportWindowContent />
    </section>
  );
}

import { DownloadButton } from "../../components/DownloadButton";
import { ShareLink } from "../../components/ShareLink";
import { sortRows } from "../../components/sortRows";
import { fieldColumns, toCsv } from "../../format/csv";
import type { MetaView, ReposView } from "../../data/schemas";
import { useView } from "../../data/useView";

type RepoRecord = ReposView["records"][number];

export interface ExportRow {
  repo_name: string;
  score_composite: number;
  score_letter: string;
}

const EXPORT_FIELDS = ["repo_name", "score_composite", "score_letter"] as const;
const DASHBOARD_VERSION = "1.0.0";

function byRepoName(a: ExportRow, b: ExportRow): number {
  if (a.repo_name === b.repo_name) return 0;
  return a.repo_name < b.repo_name ? -1 : 1;
}

export function rankedRows(records: readonly RepoRecord[]): ExportRow[] {
  const rows = records.map(({ repo_name, score_composite, score_letter }) => ({ repo_name, score_composite, score_letter }));
  return sortRows(rows, (row) => row.score_composite, "descending", byRepoName);
}

export function exportCsv(rows: readonly ExportRow[]): string {
  return toCsv(fieldColumns<ExportRow>(EXPORT_FIELDS), rows);
}

export function exportJson(rows: readonly ExportRow[], meta: MetaView | undefined): string {
  const metadata = {
    snapshot_timestamp: meta?.metadata.snapshot_timestamp ?? "unknown",
    filters: { tab: "overview" },
    scoring_config_version: meta?.config_version ?? "unknown",
    dashboard_version: DASHBOARD_VERSION,
    data_source_url: meta?.snapshot_url ?? "",
  };
  return JSON.stringify({ metadata, records: rows });
}

export function exportName(now: Date): string {
  return `openedx-health-${now.toISOString().slice(0, 10)}`;
}

function Downloads() {
  const repos = useView("repos");
  const meta = useView("meta");
  if (repos.status !== "ready") return null;
  const rows = rankedRows(repos.data.records);
  const name = exportName(new Date());
  return (
    <div className="page-actions">
      <DownloadButton label="Download CSV" filename={`${name}.csv`} mimeType="text/csv" content={() => exportCsv(rows)} />
      <DownloadButton
        label="Download JSON"
        filename={`${name}.json`}
        mimeType="application/json"
        content={() => exportJson(rows, meta.data)}
      />
    </div>
  );
}

export function ShareExport() {
  return (
    <details className="overview-section share-export">
      <summary>Share &amp; export</summary>
      <ShareLink />
      <Downloads />
    </details>
  );
}

import { applyingAdvisories, formatDay, type ForkRow } from "./rows";
import type { SignalKey } from "./signals";

interface CsvColumn {
  header: string;
  signal?: SignalKey;
  value: (row: ForkRow) => string | number | null | undefined;
}

const COLUMNS: readonly CsvColumn[] = [
  { header: "app", value: ({ app }) => app.repo },
  { header: "status", value: ({ drift }) => drift.status },
  { header: "status_basis", value: ({ drift }) => drift.status_basis },
  { header: "upstream_base", signal: "release_gap", value: ({ drift }) => drift.release_gap?.base },
  { header: "upstream_latest", signal: "release_gap", value: ({ drift }) => drift.release_gap?.latest },
  { header: "releases_behind", signal: "release_gap", value: ({ drift }) => drift.release_gap?.releases_behind },
  { header: "version_gap", signal: "release_gap", value: ({ drift }) => drift.release_gap?.level },
  { header: "behind_by", value: ({ drift }) => drift.behind_by },
  { header: "behind_release", signal: "upstream_release", value: ({ drift }) => drift.behind_release },
  { header: "ahead_by", value: ({ drift }) => drift.ahead_by },
  { header: "last_upstream_sync", value: ({ drift }) => formatDay(drift.last_upstream_merge) },
  { header: "our_release", signal: "fork_release", value: ({ drift }) => drift.fork_release?.tag },
  { header: "upstream_release", signal: "upstream_release", value: ({ drift }) => drift.upstream_release?.tag },
  { header: "applying_advisories", signal: "advisories", value: ({ drift }) => applyingAdvisories(drift) },
  { header: "licence", value: ({ app }) => app.licence },
];

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function forksCsv(rows: readonly ForkRow[], isShown: (key: SignalKey) => boolean = () => true): string {
  const columns = COLUMNS.filter((column) => !column.signal || isShown(column.signal));
  const lines = rows.map((row) => columns.map((column) => cell(column.value(row))).join(","));
  return [columns.map((column) => column.header).join(","), ...lines].join("\n") + "\n";
}

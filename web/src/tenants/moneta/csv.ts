import { formatDay, type ForkRow } from "./rows";

const HEADER = ["app", "status", "status_basis", "upstream_base", "upstream_latest", "releases_behind", "version_gap", "behind_by", "behind_release", "ahead_by", "last_upstream_sync", "our_release", "upstream_release", "new_advisories", "licence"];

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function forksCsv(rows: readonly ForkRow[]): string {
  const lines = rows.map(({ app, drift }) =>
    [
      app.repo,
      drift.status,
      drift.status_basis,
      drift.release_gap?.base,
      drift.release_gap?.latest,
      drift.release_gap?.releases_behind,
      drift.release_gap?.level,
      drift.behind_by,
      drift.behind_release,
      drift.ahead_by,
      formatDay(drift.last_upstream_merge),
      drift.fork_release?.tag,
      drift.upstream_release?.tag,
      drift.advisories.since_fork_release,
      app.licence,
    ]
      .map(cell)
      .join(","),
  );
  return [HEADER.join(","), ...lines].join("\n") + "\n";
}

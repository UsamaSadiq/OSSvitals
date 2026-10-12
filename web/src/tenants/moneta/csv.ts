import { formatDay, type ForkRow } from "./rows";

const HEADER = ["app", "status", "behind_by", "behind_release", "ahead_by", "last_upstream_sync", "our_release", "upstream_release", "new_advisories", "licence"];

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function forksCsv(rows: readonly ForkRow[]): string {
  const lines = rows.map(({ app, drift }) =>
    [
      app.repo,
      drift.status,
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

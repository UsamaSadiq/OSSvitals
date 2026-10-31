import { pluralise } from "./rows";
import type { UpgradeRecord } from "./schemas";

type Migrations = NonNullable<UpgradeRecord["migrations"]>;
type ReleaseNotes = NonNullable<UpgradeRecord["release_notes"]>;

/** Only numbering risks: the same number on both sides, or sequential numbers both sides added to one folder.
 * Timestamped migrations side by side are shown on the app page but are not a reason for attention. */
export function migrationsNotice(migrations: Migrations | undefined): string | null {
  if (!migrations) return null;
  if (migrations.same_prefix.length > 0) {
    const folders = [...new Set(migrations.same_prefix.map((clash) => clash.dir))].join(", ");
    return `${pluralise(migrations.same_prefix.length, "migration number")} in ${folders} ${migrations.same_prefix.length === 1 ? "is" : "are"} used by both us and upstream`;
  }
  if (migrations.sequential_dirs.length > 0) {
    return `We and upstream both added numbered migrations in ${migrations.sequential_dirs.join(", ")} since our last sync`;
  }
  return null;
}

export function releaseNotesNotice(notes: ReleaseNotes | undefined): string | null {
  const flagged = notes?.flagged.length ?? 0;
  if (!notes || flagged === 0) return null;
  const since = notes.since ? `after ${notes.since}` : "since our last sync";
  return `${pluralise(flagged, "upstream release")} ${since} ${flagged === 1 ? "flags" : "flag"} breaking changes or required upgrade steps`;
}

export function upgradeNotices(record: UpgradeRecord | undefined): string[] {
  if (!record || record.error) return [];
  return [migrationsNotice(record.migrations ?? undefined), releaseNotesNotice(record.release_notes ?? undefined)].filter((text): text is string => text !== null);
}

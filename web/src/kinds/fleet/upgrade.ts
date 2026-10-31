import { pluralise } from "./rows";
import type { UpgradeRecord } from "./schemas";

type Migrations = NonNullable<UpgradeRecord["migrations"]>;
type ReleaseNotes = NonNullable<UpgradeRecord["release_notes"]>;

export function migrationsNotice(migrations: Migrations | undefined): string | null {
  if (!migrations || migrations.shared_dirs.length === 0) return null;
  const folders = migrations.shared_dirs.join(", ");
  const clash = migrations.same_prefix.length > 0 ? `; ${pluralise(migrations.same_prefix.length, "migration number")} used on both sides` : "";
  return `We and upstream both added migrations in ${folders} since our last sync${clash}`;
}

export function releaseNotesNotice(notes: ReleaseNotes | undefined): string | null {
  const flagged = notes?.flagged.length ?? 0;
  if (!notes || flagged === 0) return null;
  const since = notes.since ? `since ${notes.since}` : "since our last sync";
  return `${pluralise(flagged, "upstream release")} ${since} ${flagged === 1 ? "flags" : "flag"} breaking changes or required upgrade steps`;
}

export function upgradeNotices(record: UpgradeRecord | undefined): string[] {
  if (!record || record.error) return [];
  return [migrationsNotice(record.migrations ?? undefined), releaseNotesNotice(record.release_notes ?? undefined)].filter((text): text is string => text !== null);
}

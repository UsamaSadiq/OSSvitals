import { toFixedHalfEven } from "../../format";
import { fieldColumns, toCsv } from "../../format/csv";
import type { AtRiskView } from "../../data/schemas";

export type AtRiskRow = AtRiskView["records"][number];

export const AT_RISK_CAPTION =
  "Repositories waiting for a maintainer (`openedx-unmaintained`), owned by a " +
  "single person, or with no owner, that also show weak activity, no recent " +
  "push, or a falling score. Deprecated and archived repositories are left out. Ownership " +
  "data starts with the 2026-09-24 snapshot, so score changes are shown for " +
  "repos with thin ownership today, not changes in who owns them.";

const CSV_FIELDS = [
  "repo_name",
  "owner_status",
  "owner",
  "lifecycle",
  "release",
  "score_composite",
  "score_letter",
  "score_activity",
  "days_since_push",
  "delta",
  "reasons",
  "catalog_link",
] as const satisfies readonly (keyof AtRiskRow & string)[];

function metricLabel(name: string): string {
  return name.replaceAll("_", " ");
}

function likeForLikeNote(skipped: readonly string[]): string {
  if (skipped.length === 0) return "";
  const names = skipped.map(metricLabel).sort().join(", ");
  return ` Leaves out ${names}, whose measurement changed since then, so a method change does not read as a decline.`;
}

export function baselineCaption(baselineDate: string, skipped: readonly string[] = []): string {
  return `Score change is measured against the ${baselineDate} snapshot.${likeForLikeNote(skipped)}`;
}

export function formatSignedDelta(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const fixed = toFixedHalfEven(value, 1);
  return fixed.startsWith("-") ? fixed : `+${fixed}`;
}

export function visibleRows(rows: readonly AtRiskRow[], productionOnly: boolean): readonly AtRiskRow[] {
  return productionOnly ? rows.filter((row) => row.production_or_release) : rows;
}

export function atRiskCsv(rows: readonly AtRiskRow[]): string {
  return toCsv(fieldColumns<AtRiskRow>(CSV_FIELDS), rows);
}

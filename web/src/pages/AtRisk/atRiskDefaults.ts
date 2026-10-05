import type { AtRiskView } from "../../data/schemas";

type AtRiskRow = AtRiskView["records"][number];

export const PRODUCTION_ONLY_BY_DEFAULT = true;

export function visibleRows(rows: readonly AtRiskRow[], productionOnly: boolean): readonly AtRiskRow[] {
  return productionOnly ? rows.filter((row) => row.production_or_release) : rows;
}

export function lifecycleFilterable(atRisk: AtRiskView): boolean {
  return atRisk.has_lifecycle_data && atRisk.records.length > 0;
}

export function shownAtRiskCount(atRisk: AtRiskView): number | null {
  if (!atRisk.enabled || !atRisk.has_owner_data) return null;
  return visibleRows(atRisk.records, lifecycleFilterable(atRisk) && PRODUCTION_ONLY_BY_DEFAULT).length;
}

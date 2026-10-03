import type { AttentionView } from "../../data/schemas";
import { fieldColumns, toCsv } from "../../format/csv";

export type AttentionRow = AttentionView["records"][number];

export const ALL_TIERS = "all";

export const TIER_OPTIONS = [ALL_TIERS, "critical", "important", "standard"] as const;

const CSV_FIELDS = ["repo_name", "repo_tier", "score_composite", "score_letter", "reasons"] as const;

export function rowsForTier(rows: readonly AttentionRow[], tier: string): readonly AttentionRow[] {
  if (tier === ALL_TIERS) return rows;
  return rows.filter((row) => row.repo_tier === tier);
}

export function attentionCsv(rows: readonly AttentionRow[]): string {
  return toCsv(fieldColumns<AttentionRow>(CSV_FIELDS), rows);
}

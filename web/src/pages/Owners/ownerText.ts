import { GRADE_ORDER } from "../../components/GradePill";
import type { OwnersView, ReposView } from "../../data/schemas";

export type OwnerRecord = OwnersView["records"][number];
export type OwnerRepo = OwnersView["repos"][string][number];
export type GradeMix = OwnersView["grade_mix"][string];
export type GroupName = keyof OwnersView["groups"];
export type GroupRow = NonNullable<OwnersView["groups"][GroupName]>[number];
export type HandleRepo = ReposView["records"][number];

export const OWNER_PARAM = "owner";

export const COVERAGE_CAPTION =
  "Ownership is sourced primarily from each repo's `catalog-info.yaml` " +
  "(`spec.owner`, per OEP-55). Theme/Squad come from the working-group " +
  "spreadsheet and are only present for orgs that maintain it.";

export const LOW_COVERAGE_WARNING =
  "Ownership data is not yet populated for most repositories, so these " +
  "views are mostly empty. To appear here, a repository needs " +
  "`spec.owner` set in its `catalog-info.yaml` (OEP-55).";

export const LOW_COVERAGE_PERCENT = 20;

export const MY_REPOS_CAPTION =
  "Matches GitHub handle against repo owner from repo_name and ownership/maintainer fields when available.";

// Python renders a float through repr, so whole numbers keep their ".0".
export function pythonFloat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

export function ownerKey(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeHandle(value: string): string {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function ownerSubtitle(owner: OwnerRecord): string {
  return `${capitalize(owner.owner_type)} · ${owner.repo_count} repositories`;
}

export function gradeMixCaption(mix: GradeMix): string {
  return "Grades: " + GRADE_ORDER.map((letter) => `${letter} ${mix[letter]}`).join(" · ");
}

export function groupLabel(row: GroupRow, group: GroupName): string {
  return String(row[`ownership.${group}`] ?? "");
}

function byCodePoint(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function reposForHandle(records: readonly HandleRepo[], handle: string): HandleRepo[] {
  if (!handle) return [];
  return records
    .filter((record) => record.owner_handles.includes(handle))
    .sort((a, b) => b.score_composite - a.score_composite || byCodePoint(a.repo_name, b.repo_name));
}

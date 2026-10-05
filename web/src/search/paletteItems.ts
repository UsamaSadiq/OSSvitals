import { ownerPath } from "../components/ownerPath";
import { repoDetailPath } from "../components/repoDetailPath";
import { splitRepoName } from "../components/RepoName";
import type { ChecksView, FailingChecksView, OwnersView, ReposView } from "../data/schemas";
import type { PageEntry } from "../pages/catalog";
import { rankSearchables, type Searchable } from "./match";

export const MAX_PER_SECTION = 8;

export type SectionId = "pages" | "repos" | "checks" | "owners";

export interface PaletteItem extends Searchable {
  id: string;
  section: SectionId;
  detail?: string;
  grade?: string;
  score?: number;
  to: string;
}

export interface PaletteSection {
  id: SectionId;
  title: string;
  items: PaletteItem[];
}

const SECTION_TITLES: Record<SectionId, string> = {
  pages: "Pages",
  repos: "Repositories",
  checks: "Checks",
  owners: "Owners",
};

const SECTION_ORDER: readonly SectionId[] = ["pages", "repos", "checks", "owners"];

export function failingCheckPath(check: string): string {
  return `/failing_checks?${new URLSearchParams({ category: check }).toString()}`;
}

export function pageItems(pages: readonly PageEntry[]): PaletteItem[] {
  return pages.map((page) => ({
    id: `page:${page.path}`,
    section: "pages",
    label: page.title,
    keys: [page.title],
    to: page.path,
  }));
}

export function repoItems(records: ReposView["records"]): PaletteItem[] {
  return records.map((record) => ({
    id: `repo:${record.repo_name}`,
    section: "repos",
    label: record.repo_name,
    keys: [record.repo_name, splitRepoName(record.repo_name).short],
    grade: record.score_letter,
    score: record.score_composite,
    to: repoDetailPath(record.repo_name),
  }));
}

export function failingCheckNames(failing: FailingChecksView): ReadonlySet<string> {
  return new Set(failing.records.map((row) => row.check));
}

export function checkPath(check: string, failing: ReadonlySet<string>): string {
  return failing.has(check) ? failingCheckPath(check) : "/glossary";
}

export function checkItems(records: ChecksView["records"], failing: ReadonlySet<string>): PaletteItem[] {
  return records.map((record) => ({
    id: `check:${record.check}`,
    section: "checks",
    label: record.title,
    keys: [record.title, record.check],
    detail: record.check,
    to: checkPath(record.check, failing),
  }));
}

export function ownerItems(records: OwnersView["records"]): PaletteItem[] {
  return records.map((record) => ({
    id: `owner:${record.owner_key}`,
    section: "owners",
    label: record.owner,
    keys: [record.owner, record.owner_key],
    detail: `${record.owner_type} · ${record.repo_count} ${record.repo_count === 1 ? "repo" : "repos"}`,
    to: ownerPath(record.owner_key),
  }));
}

function sectionResults(id: SectionId, items: readonly PaletteItem[], query: string): PaletteItem[] {
  if (id === "pages" && !query.trim()) return [...items];
  return rankSearchables(items, query, MAX_PER_SECTION);
}

export function searchSections(items: Partial<Record<SectionId, readonly PaletteItem[]>>, query: string): PaletteSection[] {
  return SECTION_ORDER.map((id) => ({ id, title: SECTION_TITLES[id], items: sectionResults(id, items[id] ?? [], query) })).filter(
    (section) => section.items.length > 0,
  );
}

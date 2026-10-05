import { codepointOrder, subsequenceSpan } from "../../search/match";

export const MAX_OPTIONS = 30;

interface Ranked {
  name: string;
  tier: number;
  position: number;
}

function rank(name: string, query: string): Ranked | null {
  const lowered = name.toLowerCase();
  if (lowered === query) return { name, tier: 0, position: 0 };
  const position = lowered.indexOf(query);
  if (position !== -1) return { name, tier: 1, position };
  const span = subsequenceSpan(query, lowered);
  return span === null ? null : { name, tier: 2, position: span };
}

function compareRanked(a: Ranked, b: Ranked): number {
  return a.tier - b.tier || a.position - b.position || a.name.length - b.name.length || codepointOrder(a.name, b.name);
}

export function sortedRepos(repos: readonly string[]): string[] {
  return [...repos].sort(codepointOrder);
}

const SUBSEQUENCE_TIER = 2;

function ranked(repos: readonly string[], needle: string): Ranked[] {
  return repos
    .map((name) => rank(name, needle))
    .filter((entry): entry is Ranked => entry !== null)
    .sort(compareRanked);
}

export function rankRepos(repos: readonly string[], query: string, limit = MAX_OPTIONS): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return sortedRepos(repos);
  return ranked(repos, needle)
    .slice(0, limit)
    .map((entry) => entry.name);
}

export function containingRepos(repos: readonly string[], query: string, limit: number): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return ranked(repos, needle)
    .filter((entry) => entry.tier < SUBSEQUENCE_TIER)
    .slice(0, limit)
    .map((entry) => entry.name);
}

export function codepointOrder(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function subsequenceSpan(query: string, name: string): number | null {
  let start = -1;
  let cursor = 0;
  for (const char of query) {
    const found = name.indexOf(char, cursor);
    if (found === -1) return null;
    if (start === -1) start = found;
    cursor = found + 1;
  }
  return cursor - start;
}

export const MatchTier = { Exact: 0, Prefix: 1, Substring: 2, Subsequence: 3 } as const;

export type MatchTier = (typeof MatchTier)[keyof typeof MatchTier];

export interface Match {
  tier: MatchTier;
  position: number;
}

export function matchText(text: string, needle: string): Match | null {
  const lowered = text.toLowerCase();
  if (lowered === needle) return { tier: MatchTier.Exact, position: 0 };
  if (lowered.startsWith(needle)) return { tier: MatchTier.Prefix, position: 0 };
  const position = lowered.indexOf(needle);
  if (position !== -1) return { tier: MatchTier.Substring, position };
  const span = subsequenceSpan(needle, lowered);
  return span === null ? null : { tier: MatchTier.Subsequence, position: span };
}

function compareMatches(a: Match, b: Match): number {
  return a.tier - b.tier || a.position - b.position;
}

export function bestMatch(texts: readonly string[], needle: string): Match | null {
  return texts
    .map((text) => matchText(text, needle))
    .filter((match): match is Match => match !== null)
    .reduce<Match | null>((best, match) => (best === null || compareMatches(match, best) < 0 ? match : best), null);
}

export interface Searchable {
  label: string;
  keys: readonly string[];
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function rankSearchables<Item extends Searchable>(items: readonly Item[], query: string, limit: number): Item[] {
  const needle = normalizeQuery(query);
  if (!needle) return [];
  return items
    .map((item) => ({ item, match: bestMatch(item.keys, needle) }))
    .filter((entry): entry is { item: Item; match: Match } => entry.match !== null)
    .sort(
      (a, b) =>
        compareMatches(a.match, b.match) ||
        a.item.label.length - b.item.label.length ||
        codepointOrder(a.item.label, b.item.label),
    )
    .slice(0, limit)
    .map((entry) => entry.item);
}

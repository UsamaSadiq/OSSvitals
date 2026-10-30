import type { AttentionView, ComponentsView, SupportWindowView, UpgradesView } from "../data/schemas";

export interface CountNoun {
  one: string;
  many: string;
}

export const REPOSITORIES: CountNoun = { one: "repository", many: "repositories" };
export const FAILING_JOBS: CountNoun = { one: "failing upgrade job", many: "failing upgrade jobs" };
export const SUPPORT_PROBLEMS: CountNoun = {
  one: "product out of date or past end of life",
  many: "products out of date or past end of life",
};

export function attentionCount(attention: AttentionView): number {
  return attention.records.length;
}

export function failingUpgradeCount(upgrades: UpgradesView): number | null {
  return upgrades.upgrade_jobs?.states.failing ?? null;
}

export function supportProblemCount(support: SupportWindowView): number | null {
  if (!support.available || !support.summary) return null;
  return (support.summary.drift ?? 0) + (support.summary.eol ?? 0);
}

export function catalogProblemCount(components: ComponentsView): number | null {
  return components.available ? (components.summary?.with_problem ?? null) : null;
}

export function countText(count: number, noun: CountNoun): string {
  return `${count} ${count === 1 ? noun.one : noun.many}`;
}

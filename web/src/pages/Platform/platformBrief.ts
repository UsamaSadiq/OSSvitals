import type { PlatformView } from "../../data/schemas";
import { formatCount, formatNumber } from "../../format";
import { change, changeSince, changeText, releaseLabel } from "./platformRows";

export interface BriefPoint {
  topic: string;
  text: string;
  href: string;
}

type UpgradeRelease = NonNullable<NonNullable<PlatformView["upgrade_cost"]>["releases"]>[number];

function sentences(parts: (string | null)[]): string | null {
  const kept = parts.filter((part): part is string => Boolean(part));
  return kept.length ? `${kept.join(". ")}.` : null;
}

function point(topic: string, href: string, parts: (string | null)[]): BriefPoint | null {
  const text = sentences(parts);
  return text ? { topic, href, text } : null;
}

function listed(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : (items[0] ?? "");
}

function extractedText(extracted: number, blocks: number, destination: string): string {
  if (extracted === 0) return `None of the ${formatNumber(blocks)} built-in XBlocks has moved out of the platform yet`;
  const verb = extracted === 1 ? "has" : "have";
  return `${formatNumber(extracted)} of the ${formatCount(blocks, "built-in XBlock")} ${verb} moved out of the platform into ${destination}`;
}

function modularizationPoint(view: PlatformView): BriefPoint | null {
  const section = view.modularization;
  const { extracted, blocks } = section.summary ?? {};
  if (!section.available || extracted == null || !blocks) return null;
  const legacy = changeText(change(section.legacy_frontend?.history ?? []));
  return point("Modularization", "#modularization", [
    extractedText(extracted, blocks, section.extracted_package ? section.extracted_package : "separate packages"),
    legacy ? `Legacy frontend files are ${legacy}` : null,
  ]);
}

function stabilityPoint(view: PlatformView): BriefPoint | null {
  const section = view.trends;
  const { first, latest, first_year: firstYear, latest_year: latestYear } = section?.summary ?? {};
  if (!section?.available || !latest || !latestYear) return null;
  const commits = changeSince(first?.commits, latest.commits, firstYear);
  const now = section.years?.[section.years.length - 1]?.python_lines;
  const lines = changeSince(first?.python_lines, now, firstYear);
  return point("Stability", "#stability", [
    `${formatCount(latest.commits, "commit")} by ${formatCount(latest.authors, "author")} in ${latestYear}${commits ? `, commits ${commits}` : ""}`,
    now != null ? `${formatCount(now, "line")} of Python outside tests and migrations${lines ? `, ${lines}` : ""}` : null,
  ]);
}

function extensionPoint(view: PlatformView): BriefPoint | null {
  const summary = view.extension_points?.available ? view.extension_points.summary : undefined;
  if (!summary) return null;
  const counts = [
    summary.filters?.now != null ? formatCount(summary.filters.now, "filter") : null,
    summary.events?.now != null ? formatCount(summary.events.now, "event") : null,
    summary.plugin_slots?.now != null ? formatCount(summary.plugin_slots.now, "frontend plugin slot") : null,
  ].filter((count): count is string => count !== null);
  const slots = summary.plugin_slots;
  const growth =
    slots?.first && slots.now != null && slots.now !== slots.first.count
      ? `Plugin slots went from ${formatNumber(slots.first.count)} at ${releaseLabel(slots.first.release)} to ${formatNumber(slots.now)}`
      : null;
  return point("Extension points", "#extension-points", [
    counts.length ? `Ways to customise the platform without forking it: ${listed(counts)}` : null,
    growth,
  ]);
}

function hasCost(release: UpgradeRelease): boolean {
  return release.deprecations.total > 0 || (release.breaking_changes ?? 0) > 0;
}

function releaseCostText(release: UpgradeRelease): string {
  const name = releaseLabel(release.release);
  const { total, open } = release.deprecations;
  const tickets =
    total > 0
      ? `${formatCount(total, "deprecation")} ${total === 1 ? "names" : "name"} ${name} as the first release without ${total === 1 ? "it" : "them"}` +
        (open > 0 ? ` (${formatNumber(open)} still open)` : "")
      : null;
  const changes = release.breaking_changes ? formatCount(release.breaking_changes, "breaking change") : null;
  if (tickets && changes) return `${tickets}, and its release notes list ${changes}`;
  return tickets ?? `${name}'s release notes list ${changes}`;
}

function upgradePoint(view: PlatformView): BriefPoint | null {
  const section = view.upgrade_cost;
  if (!section?.available) return null;
  const latest = [...(section.releases ?? [])].reverse().find((row) => row.date && hasCost(row));
  const days = section.summary?.median_days_between;
  const open = section.summary?.open_deprecations;
  return point("Upgrade cost", "#upgrade-cost", [
    days != null ? `A named release every ${formatCount(days, "day")} (median)` : null,
    latest ? releaseCostText(latest) : null,
    open ? `${formatCount(open, "deprecation")} ${open === 1 ? "is" : "are"} still open` : null,
  ]);
}

export function briefPoints(view: PlatformView): BriefPoint[] {
  return [modularizationPoint(view), stabilityPoint(view), extensionPoint(view), upgradePoint(view)].filter(
    (entry): entry is BriefPoint => entry !== null,
  );
}

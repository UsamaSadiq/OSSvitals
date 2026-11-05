import type { PlatformView } from "../../data/schemas";
import { formatNumber } from "../../format";
import { change, changeSince, changeText, releaseLabel } from "./platformRows";

export interface BriefPoint {
  topic: string;
  text: string;
  href: string;
}

function joined(parts: (string | null)[]): string {
  return `${parts.filter(Boolean).join(". ")}.`;
}

function modularizationPoint(view: PlatformView): BriefPoint | null {
  const section = view.modularization;
  if (!section.available || !section.summary?.blocks) return null;
  const legacy = changeText(change(section.legacy_frontend?.history ?? []));
  return {
    topic: "Modularization",
    href: "#modularization",
    text: joined([
      `${formatNumber(section.summary.extracted ?? 0)} of ${formatNumber(section.summary.blocks)} built-in XBlocks now ship as a separate package`,
      legacy ? `Legacy frontend files are ${legacy}` : null,
    ]),
  };
}

function stabilityPoint(view: PlatformView): BriefPoint | null {
  const section = view.trends;
  const { first, latest, first_year: firstYear, latest_year: latestYear } = section?.summary ?? {};
  if (!section?.available || !latest || !latestYear) return null;
  const commits = changeSince(first?.commits, latest.commits, firstYear);
  const now = section.years?.[section.years.length - 1]?.python_lines;
  const lines = changeSince(first?.python_lines, now, firstYear);
  return {
    topic: "Stability",
    href: "#stability",
    text: joined([
      `${formatNumber(latest.commits)} commits by ${formatNumber(latest.authors)} authors in ${latestYear}${commits ? `, commits ${commits}` : ""}`,
      now != null ? `${formatNumber(now)} lines of Python outside tests${lines ? `, ${lines}` : ""}` : null,
    ]),
  };
}

function extensionPoint(view: PlatformView): BriefPoint | null {
  const summary = view.extension_points?.available ? view.extension_points.summary : undefined;
  if (!summary?.filters || !summary.events || !summary.plugin_slots) return null;
  const slots = summary.plugin_slots;
  const slotChange = slots.first ? changeSince(slots.first.count, slots.now, releaseLabel(slots.first.release)) : null;
  return {
    topic: "Customising without forking",
    href: "#extension-points",
    text: joined([
      `${formatNumber(summary.filters.now ?? 0)} filters, ${formatNumber(summary.events.now ?? 0)} events and ${formatNumber(slots.now ?? 0)} frontend plugin slots`,
      slotChange ? `Plugin slots are ${slotChange}` : null,
    ]),
  };
}

function latestReleaseText(release: NonNullable<NonNullable<PlatformView["upgrade_cost"]>["releases"]>[number]): string {
  const breaking =
    release.breaking_changes != null ? ` and lists ${formatNumber(release.breaking_changes)} breaking changes` : "";
  return `${releaseLabel(release.release)} drops ${formatNumber(release.deprecations.total)} deprecated features${breaking}`;
}

function upgradePoint(view: PlatformView): BriefPoint | null {
  const section = view.upgrade_cost;
  if (!section?.available) return null;
  const latest = [...(section.releases ?? [])].reverse().find((row) => row.date);
  const days = section.summary?.median_days_between;
  const open = section.summary?.open_deprecations;
  const parts = [
    days != null ? `A named release every ${formatNumber(days)} days (median)` : null,
    latest ? latestReleaseText(latest) : null,
    open != null ? `${formatNumber(open)} deprecations are still open` : null,
  ];
  if (!parts.some(Boolean)) return null;
  return { topic: "Upgrade cost", href: "#upgrade-cost", text: joined(parts) };
}

export function briefPoints(view: PlatformView): BriefPoint[] {
  return [modularizationPoint(view), stabilityPoint(view), extensionPoint(view), upgradePoint(view)].filter(
    (point): point is BriefPoint => point !== null,
  );
}

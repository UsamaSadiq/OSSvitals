import type { ConflictsView, DriftRecord, FleetManifest, ManifestStatus } from "./schemas";
import { SURFACE_LABELS, type SignalInfo, type SignalKey, type Surface } from "./signals";

export type SignalState = "shown" | "hidden_by_viewer" | "not_shown" | "off";

export const STATE_LABELS: Record<SignalState, string> = {
  shown: "Shown",
  hidden_by_viewer: "Hidden by you",
  not_shown: "Collected, not shown",
  off: "Off",
};

export function signalState(manifest: FleetManifest, hiddenByViewer: ReadonlySet<string>, key: SignalKey): SignalState {
  const signal = manifest.signals[key];
  if (!signal?.collect) return "off";
  if (signal.show.length === 0) return "not_shown";
  return hiddenByViewer.has(key) ? "hidden_by_viewer" : "shown";
}

export function surfacesText(show: readonly string[]): string {
  return show.map((surface) => SURFACE_LABELS[surface as Surface] ?? surface).join(", ");
}

/** Forks whose latest record has this signal's field as `null`, or a weekly record carrying an error. */
export function failedCount(info: SignalInfo, records: readonly DriftRecord[], conflicts: ConflictsView | null): number {
  if (info.key === "conflicts") return conflicts?.records.filter((record) => record.error).length ?? 0;
  const field = info.failureField;
  return field ? records.filter((record) => field in record && record[field] === null).length : 0;
}

function settingValue(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export function settingsText(settings: Readonly<Record<string, unknown>>): string[] {
  return Object.entries(settings).map(([name, value]) => `${name.replaceAll("_", " ")}: ${settingValue(value)}`);
}

export function statusesUsing(statuses: readonly ManifestStatus[], thresholds: readonly string[]): string[] {
  return statuses.filter((status) => thresholds.some((threshold) => threshold in status)).map((status) => status.label);
}

export function proposalYaml(key: SignalKey, collect: boolean): string {
  return `signals:\n  ${key}:\n    collect: ${collect ? "false" : "true"}\n`;
}

export function editConfigUrl(sourceUrl: string, org: string): string {
  return `${sourceUrl.replace(/\/$/, "")}/edit/main/dashboard/config/${encodeURIComponent(org)}/fleet.yaml`;
}

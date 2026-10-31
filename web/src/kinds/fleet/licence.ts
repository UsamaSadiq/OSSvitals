import { formatDay } from "./rows";
import type { DriftRecord } from "./schemas";

type LicenceWatch = NonNullable<DriftRecord["licence_watch"]>;

function whatChanged(watch: LicenceWatch): string {
  if (!watch.spdx || !watch.previous_spdx) return "";
  return watch.spdx === watch.previous_spdx ? `, still ${watch.spdx}` : `, ${watch.previous_spdx} → ${watch.spdx}`;
}

function mismatch(watch: LicenceWatch): string | null {
  return watch.matches_declared === false ? `Upstream's licence is ${watch.spdx}; we list ${watch.declared}` : null;
}

function change(watch: LicenceWatch, day: string): string {
  if (!watch.present) return `Upstream removed its licence file on ${day}`;
  if (watch.previous_present === false) return `Upstream added a licence file on ${day}`;
  return `Upstream's licence file changed on ${day}${whatChanged(watch)}`;
}

/** Says the file changed, never that upstream relicensed: a copyright-year bump changes it too. */
export function licenceNotice(watch: DriftRecord["licence_watch"]): string | null {
  if (!watch) return null;
  if (watch.changed_on) return [change(watch, formatDay(watch.changed_on)), mismatch(watch)].filter(Boolean).join(". ");
  if (!watch.present) return "Upstream has no licence file";
  return mismatch(watch);
}

export function licenceHistoryUrl(upstreamUrl: string, branch: string, path: string): string {
  return `${upstreamUrl}/commits/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

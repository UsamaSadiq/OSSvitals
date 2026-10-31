import { formatDay } from "./rows";
import type { DriftRecord } from "./schemas";

type LicenceWatch = NonNullable<DriftRecord["licence_watch"]>;

function whatChanged(watch: LicenceWatch): string {
  if (!watch.spdx || !watch.previous_spdx) return "";
  return watch.spdx === watch.previous_spdx ? `, still ${watch.spdx}` : `, ${watch.previous_spdx} → ${watch.spdx}`;
}

/** Says the file changed, never that upstream relicensed: a copyright-year bump changes it too. */
export function licenceNotice(watch: DriftRecord["licence_watch"]): string | null {
  if (!watch) return null;
  if (watch.changed_on) {
    const day = formatDay(watch.changed_on);
    return watch.present ? `Upstream's licence file changed on ${day}${whatChanged(watch)}` : `Upstream removed its licence file on ${day}`;
  }
  if (!watch.present) return "Upstream has no licence file";
  if (watch.matches_declared === false) return `Upstream's licence is ${watch.spdx}; we list ${watch.declared}`;
  return null;
}

export function licenceHistoryUrl(upstreamUrl: string, branch: string, path: string): string {
  return `${upstreamUrl}/commits/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

import { formatAge } from "../format";
import type { FreshnessBannerProps } from "./FreshnessBanner";
import { useSiteMeta } from "./siteMeta";

export type ChipTone = "fresh" | "warn" | "fail";

export interface ChipContent {
  tone: ChipTone;
  label: string;
  detail?: string;
  title: string;
}

const UPDATE_CADENCE = "updated daily";

export function freshnessChip(freshness: FreshnessBannerProps, snapshotDate: string | undefined): ChipContent {
  if (freshness.level === "unknown" || !snapshotDate) {
    return { tone: "fail", label: "Data date unknown", title: "The snapshot timestamp is unavailable." };
  }
  const label = `Data ${snapshotDate}`;
  if (freshness.level === "fresh") {
    return { tone: "fresh", label, detail: UPDATE_CADENCE, title: `Snapshot ${snapshotDate} (UTC), ${UPDATE_CADENCE}` };
  }
  return {
    tone: freshness.level === "critical" ? "fail" : "warn",
    label,
    detail: `${formatAge(freshness.ageHours)} old`,
    title: `Snapshot ${snapshotDate} (UTC), past the ${freshness.staleThresholdHours}h freshness threshold`,
  };
}

export function FreshnessChip() {
  const { freshness, snapshotDate } = useSiteMeta();
  if (!freshness) return null;
  const chip = freshnessChip(freshness, snapshotDate);
  return (
    <span className={`freshness-chip freshness-chip--${chip.tone}`} title={chip.title}>
      <span className="freshness-chip__dot" aria-hidden="true" />
      <span>{chip.label}</span>
      {chip.detail && <span className="freshness-chip__detail"> · {chip.detail}</span>}
    </span>
  );
}

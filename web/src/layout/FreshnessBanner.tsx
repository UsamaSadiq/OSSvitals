import { formatAge } from "../format";

export type FreshnessBannerProps =
  | { level: "fresh" }
  | { level: "unknown" }
  | { level: "stale" | "critical"; ageHours: number; snapshotDate: string; staleThresholdHours: number };

function bannerBody(props: Extract<FreshnessBannerProps, { level: "stale" | "critical" }>): string {
  if (props.level === "critical") {
    return (
      `Snapshot ${props.snapshotDate} (UTC). The upstream pipeline may have stopped; everything ` +
      "below describes the repositories as they were at that point, not as they are now."
    );
  }
  return (
    `Snapshot ${props.snapshotDate} (UTC), past the ${props.staleThresholdHours}h freshness ` +
    "threshold. Recent changes will not appear yet."
  );
}

export function FreshnessBanner(props: FreshnessBannerProps) {
  if (props.level === "fresh") return null;

  if (props.level === "unknown") {
    return (
      <div className="banner banner--error" role="alert">
        <strong>Snapshot timestamp unavailable.</strong>
        <p>The dashboard cannot tell how old this data is.</p>
      </div>
    );
  }

  const tone = props.level === "critical" ? "banner--error" : "banner--warn";
  return (
    <div className={`banner ${tone}`} role={props.level === "critical" ? "alert" : "status"}>
      <strong>This data is {formatAge(props.ageHours)} old.</strong>
      <p>{bannerBody(props)}</p>
    </div>
  );
}

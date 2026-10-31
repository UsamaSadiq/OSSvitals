import { pluralise } from "./rows";
import type { DriftRecord } from "./schemas";

type Health = NonNullable<DriftRecord["upstream_health"]>;

function peopleText(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "person" : "people"}`;
}

export function contributorsText(contributors: Health["contributors"]): string {
  if (!contributors) return "Contributor counts are not available yet";
  if (!contributors.half_of_commits_by) return "No commits on upstream's default branch in the last year";
  const share = Math.round((contributors.top_share ?? 0) * 100);
  return `${peopleText(contributors.half_of_commits_by)} made half of last year's ${contributors.commits.toLocaleString()} commits (the most active ${share}%); ${peopleText(contributors.people)} in all`;
}

export function releasesText(releases: Health["releases"]): string {
  if (releases.days_since_latest === null || releases.days_since_latest === undefined) return "Upstream publishes no GitHub releases";
  if (releases.last_year === 0) return `No release in the last year; the latest was ${releases.days_since_latest} days ago`;
  const cadence = releases.median_gap_days ? `, typically ${releases.median_gap_days} days apart` : "";
  return `${pluralise(releases.last_year, "release")} in the last year, the latest ${releases.days_since_latest} days ago${cadence}`;
}

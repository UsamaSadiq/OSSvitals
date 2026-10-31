import { pluralise } from "./rows";
import type { DriftRecord } from "./schemas";

type Health = NonNullable<DriftRecord["upstream_health"]>;

function peopleText(count: number, atLeast = false): string {
  return `${atLeast ? "at least " : ""}${count.toLocaleString()} ${count === 1 ? "person" : "people"}`;
}

/** Counts cover upstream's default branch and leave out bots and agents (dependabot, claude, cursoragent...). */
export function contributorsText(contributors: Health["contributors"]): string {
  if (!contributors) return "Contributor counts are not available yet";
  const commits = contributors.commits.toLocaleString();
  if (!contributors.half_of_commits_by) {
    const automated = contributors.automated_commits ? `; ${contributors.automated_commits.toLocaleString()} by bots and agents` : "";
    return `No commits by people on upstream's default branch in the last year${automated}`;
  }
  const everyone = `${peopleText(contributors.people, Boolean(contributors.truncated))} in all`;
  const share = Math.round((contributors.top_share ?? 0) * 100);
  if (contributors.half_of_commits_by === 1) return `One person made ${share}% of last year's ${commits} commits on upstream's default branch; ${everyone}`;
  return `${peopleText(contributors.half_of_commits_by)} made half of last year's ${commits} commits on upstream's default branch (the most active alone made ${share}%); ${everyone}`;
}

export function releasesText(releases: Health["releases"]): string {
  if (releases.days_since_latest === null || releases.days_since_latest === undefined) return "Upstream publishes no GitHub releases";
  if (releases.last_year === 0) return `No release in the last year; the latest was ${releases.days_since_latest} days ago`;
  const cadence = releases.median_gap_days ? `, typically ${releases.median_gap_days} days apart` : "";
  return `${pluralise(releases.last_year, "release")} in the last year, the latest ${releases.days_since_latest} days ago${cadence}`;
}

export function healthNotes(health: Health, trackedBranch: string | null): string[] {
  const counted = health.contributors?.as_of ? `Contributors counted ${health.contributors.as_of}.` : null;
  const branch =
    health.tracks_default_branch === false && health.default_branch
      ? `These counts are for ${health.default_branch}, upstream's default branch, not ${trackedBranch ?? "the branch we track"}.`
      : null;
  return [releasesText(health.releases), counted, branch].filter((note): note is string => note !== null);
}

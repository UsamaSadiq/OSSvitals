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
  const truncated = Boolean(contributors.truncated);
  const everyone = `${peopleText(contributors.people, truncated)} in all`;
  const share = Math.round((contributors.top_share ?? 0) * 100);
  const total = `${truncated ? "at least " : "the "}${commits} commits made last year on upstream's default branch`;
  const scope = truncated ? ", counting the 100 people GitHub lists" : "";
  if (contributors.half_of_commits_by === 1) return `One person made ${share}% of ${total}${scope}; ${everyone}`;
  return `${peopleText(contributors.half_of_commits_by)} made half of ${total}${scope} (the most active alone made ${share}%); ${everyone}`;
}

function daysAgo(days: number): string {
  return days === 0 ? "today" : `${pluralise(days, "day")} ago`;
}

export function releasesText(releases: Health["releases"]): string {
  if (releases.days_since_latest === null || releases.days_since_latest === undefined) return "Upstream publishes no GitHub releases";
  if (releases.last_year === 0) return `No release in the last year; the latest was ${daysAgo(releases.days_since_latest)}`;
  const gap = releases.median_gap_days;
  const cadence = gap === null || gap === undefined ? "" : gap === 0 ? ", often several on the same day" : `, typically ${gap} days apart`;
  return `${pluralise(releases.last_year, "release")} in the last year, the latest ${daysAgo(releases.days_since_latest)}${cadence}`;
}

export function healthNotes(health: Health, trackedBranch: string | null): string[] {
  const counted = health.contributors?.as_of ? `Contributors counted ${health.contributors.as_of}.` : null;
  const branch =
    health.tracks_default_branch === false && health.default_branch
      ? `These counts are for ${health.default_branch}, upstream's default branch, not ${trackedBranch ?? "the branch we track"}.`
      : null;
  return [releasesText(health.releases), counted, branch].filter((note): note is string => note !== null);
}

import { describe, expect, it } from "vitest";
import { contributorsText, healthNotes, releasesText } from "./health";

const base = { commits: 2544, automated_commits: 446, people: 57, half_of_commits_by: 1, top_share: 0.78, truncated: false, as_of: "2026-10-31" };

describe("upstream health wording", () => {
  it("says what one person made, or how many made half and what the most active made alone", () => {
    expect(contributorsText(base)).toBe("One person made 78% of last year's 2,544 commits on upstream's default branch; 57 people in all");
    expect(contributorsText({ ...base, commits: 2834, people: 268, half_of_commits_by: 5, top_share: 0.144 })).toBe(
      "5 people made half of last year's 2,834 commits on upstream's default branch (the most active alone made 14%); 268 people in all",
    );
  });

  it("says at least when GitHub cut the list short, and never calls a bot-only upstream idle", () => {
    expect(contributorsText({ ...base, people: 34, truncated: true })).toContain("at least 34 people in all");
    expect(contributorsText({ ...base, commits: 0, people: 0, half_of_commits_by: null, top_share: null, automated_commits: 90 })).toBe(
      "No commits by people on upstream's default branch in the last year; 90 by bots and agents",
    );
    expect(contributorsText(null)).toBe("Contributor counts are not available yet");
  });

  it("describes release cadence, and an upstream without GitHub releases as such", () => {
    expect(releasesText({ last_year: 18, days_since_latest: 7, median_gap_days: 10 })).toBe("18 releases in the last year, the latest 7 days ago, typically 10 days apart");
    expect(releasesText({ last_year: 0, days_since_latest: 400, median_gap_days: null })).toBe("No release in the last year; the latest was 400 days ago");
    expect(releasesText({ last_year: 0, days_since_latest: null, median_gap_days: null })).toBe("Upstream publishes no GitHub releases");
  });

  it("notes when the counts were taken and when they cover a different branch", () => {
    const health = { contributors: base, releases: { last_year: 1, days_since_latest: 3, median_gap_days: null }, default_branch: "main", tracks_default_branch: false };
    expect(healthNotes(health, "preview")).toEqual([
      "1 release in the last year, the latest 3 days ago",
      "Contributors counted 2026-10-31.",
      "These counts are for main, upstream's default branch, not preview.",
    ]);
  });
});

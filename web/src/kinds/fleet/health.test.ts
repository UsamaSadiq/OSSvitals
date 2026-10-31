import { describe, expect, it } from "vitest";
import { contributorsText, releasesText } from "./health";

describe("upstream health wording", () => {
  it("names how few people made half the work", () => {
    expect(contributorsText({ commits: 2544, people: 57, half_of_commits_by: 1, top_share: 0.78 })).toBe(
      "1 person made half of last year's 2,544 commits (the most active 78%); 57 people in all",
    );
    expect(contributorsText({ commits: 0, people: 0, half_of_commits_by: null, top_share: null })).toBe("No commits on upstream's default branch in the last year");
    expect(contributorsText(null)).toBe("Contributor counts are not available yet");
  });

  it("describes release cadence, and an upstream without GitHub releases as such", () => {
    expect(releasesText({ last_year: 18, days_since_latest: 7, median_gap_days: 10 })).toBe("18 releases in the last year, the latest 7 days ago, typically 10 days apart");
    expect(releasesText({ last_year: 0, days_since_latest: 400, median_gap_days: null })).toBe("No release in the last year; the latest was 400 days ago");
    expect(releasesText({ last_year: 0, days_since_latest: null, median_gap_days: null })).toBe("Upstream publishes no GitHub releases");
  });
});

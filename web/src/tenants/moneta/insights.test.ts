import { describe, expect, it } from "vitest";
import { attentionReasons, sparklinePoints, statusChanges, trendDirection, trendOf } from "./insights";
import type { ForkRow } from "./rows";
import type { HistoryRow } from "./schemas";

function row(date: string, repo: string, status: string, behind: number): HistoryRow {
  return { date, repo, status, behind_by: behind, ahead_by: 1, advisories_since_release: 0 };
}

const HISTORY = [
  row("2026-08-02", "a", "critical", 120),
  row("2026-08-01", "a", "stale", 100),
  row("2026-08-03", "a", "critical", 130),
  row("2026-08-01", "b", "lagging", 10),
  row("2026-08-02", "b", "lagging", 11),
];

describe("statusChanges", () => {
  it("reports each transition once, newest first, regardless of row order", () => {
    expect(statusChanges(HISTORY, 10)).toEqual([{ date: "2026-08-02", repo: "a", from: "stale", to: "critical" }]);
  });

  it("limits the feed and reports nothing for a single day of history", () => {
    expect(statusChanges(HISTORY, 0)).toEqual([]);
    expect(statusChanges([row("2026-08-01", "a", "stale", 1)], 5)).toEqual([]);
  });
});

describe("trendOf and trendDirection", () => {
  it("returns one repo's days in order", () => {
    expect(trendOf(HISTORY, "a")).toEqual([
      { date: "2026-08-01", behind: 100 },
      { date: "2026-08-02", behind: 120 },
      { date: "2026-08-03", behind: 130 },
    ]);
  });

  it("calls the direction from the first and last day", () => {
    expect(trendDirection(trendOf(HISTORY, "a"))).toBe("falling-behind");
    expect(trendDirection([{ date: "d1", behind: 9 }, { date: "d2", behind: 3 }])).toBe("catching-up");
    expect(trendDirection([{ date: "d1", behind: 5 }, { date: "d2", behind: 5 }])).toBe("steady");
    expect(trendDirection([{ date: "d1", behind: 5 }])).toBe("unknown");
  });
});

describe("sparklinePoints", () => {
  it("scales values into the box with the lowest at the bottom", () => {
    expect(sparklinePoints([0, 5, 10], 100, 20)).toBe("0.0,20.0 50.0,10.0 100.0,0.0");
  });

  it("draws a flat series without dividing by zero and handles no data", () => {
    expect(sparklinePoints([4, 4], 10, 10)).toBe("0.0,10.0 10.0,10.0");
    expect(sparklinePoints([], 10, 10)).toBe("");
  });
});

describe("attentionReasons", () => {
  function fork(overrides: Partial<ForkRow["drift"]>): ForkRow {
    return {
      app: { repo: "x", class: "fork", url: "", description: null, licence: null, upstream: "a/x", upstream_url: null, upstream_branch: "main", production_branch: "foss-main", purpose: null, what_we_changed: null, pushed_at: "", open_pull_requests: 0, latest_tag: null },
      drift: {
        repo: "x",
        status: "critical",
        ahead_by: 1,
        behind_by: 4849,
        last_upstream_merge: "",
        days_since_upstream_merge: 164,
        fork_release: { tag: "v1", date: null },
        upstream_release: null,
        advisories: { published: 0, since_fork_release: 0, source: "x" },
        promotion: null,
        ...overrides,
      },
    };
  }

  it("always explains the drift", () => {
    expect(attentionReasons(fork({}), undefined)).toEqual(["4,849 commits behind upstream, last synced 164 days ago"]);
  });

  it("adds a line for each other problem it can see", () => {
    const row = fork({
      advisories: { published: 3, since_fork_release: 2, source: "x" },
      ci: { state: "failing", total: 3 },
      fork_release: null,
      upstream_activity: { pushed_at: "", idle_days: 400, quiet: true },
    });
    const conflict = { repo: "x", against_upstream_head: { clean: false, conflicted_files: ["a"], conflicted_total: 1 } };
    expect(attentionReasons(row, conflict)).toEqual([
      "4,849 commits behind upstream, last synced 164 days ago",
      "2 new upstream advisories since our latest release",
      "Checks are failing on our release branch",
      "We have not cut a release of our own yet",
      "Syncing with upstream would conflict on 1 file",
      "Upstream has gone quiet",
    ]);
  });
});

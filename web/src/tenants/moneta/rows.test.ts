import { describe, expect, it } from "vitest";
import { forkRows, needingAttention, overviewStats, severity, sortedForks, statusCounts } from "./rows";
import type { AppRecord, DriftRecord } from "./schemas";

function app(repo: string, kind: AppRecord["class"] = "fork"): AppRecord {
  return {
    repo,
    class: kind,
    url: `https://github.com/Org/${repo}`,
    description: null,
    licence: "MIT",
    upstream: kind === "fork" ? `up/${repo}` : null,
    upstream_url: null,
    upstream_branch: null,
    production_branch: null,
    purpose: null,
    what_we_changed: null,
    pushed_at: "2026-10-01T00:00:00Z",
    open_pull_requests: 0,
    latest_tag: null,
  };
}

function drift(repo: string, status: string, behind: number): DriftRecord {
  return {
    repo,
    status,
    ahead_by: 1,
    behind_by: behind,
    last_upstream_merge: "2026-09-01T00:00:00Z",
    days_since_upstream_merge: 10,
    fork_release: null,
    upstream_release: null,
    advisories: { published: 0, since_fork_release: 0, source: "github-published-advisories" },
    promotion: null,
  };
}

const APPS = [app("a"), app("b"), app("c"), app("tool", "original"), app("nodrift")];
const DRIFT = [drift("a", "stale", 10), drift("b", "critical", 5), drift("c", "stale", 90)];

describe("forkRows", () => {
  it("drops originals and forks without a drift record", () => {
    expect(forkRows(APPS, DRIFT).map((row) => row.app.repo)).toEqual(["a", "b", "c"]);
  });
});

describe("sortedForks", () => {
  it("orders by severity, then by commits behind", () => {
    expect(sortedForks(forkRows(APPS, DRIFT)).map((row) => row.app.repo)).toEqual(["b", "c", "a"]);
  });
});

describe("statusCounts and severity", () => {
  it("counts each known status and ignores unknown ones", () => {
    const rows = forkRows([app("a"), app("b")], [drift("a", "stale", 1), drift("b", "mystery", 1)]);
    expect(statusCounts(rows)).toEqual({ "in-sync": 0, lagging: 0, stale: 1, critical: 0 });
  });

  it("ranks an unknown status below every known one", () => {
    expect(severity("mystery")).toBe(-1);
    expect(severity("critical")).toBeGreaterThan(severity("in-sync"));
  });
});

describe("overviewStats", () => {
  const rows = forkRows(APPS, DRIFT);

  it("counts every status, including zeros, with a filtered apps link for each", () => {
    const { statuses, total, originals } = overviewStats(rows, 1);
    expect(statuses.map((stat) => [stat.key, stat.count, stat.to])).toEqual([
      ["in-sync", 0, "/apps?status=in-sync"],
      ["lagging", 0, "/apps?status=lagging"],
      ["stale", 2, "/apps?status=stale"],
      ["critical", 1, "/apps?status=critical"],
    ]);
    expect(total.count).toBe(3);
    expect(originals).toMatchObject({ count: 1, to: "/apps#originals" });
  });

  it("counts licences and encodes them in the link", () => {
    expect(overviewStats(rows, 0).licences).toEqual([{ key: "MIT", label: "MIT", count: 3, to: "/apps?licence=MIT" }]);
  });
});

describe("needingAttention", () => {
  it("keeps only stale and critical forks, worst first", () => {
    const rows = forkRows([...APPS, app("calm")], [...DRIFT, drift("calm", "in-sync", 0)]);
    expect(needingAttention(rows).map((row) => row.app.repo)).toEqual(["b", "c", "a"]);
  });
});

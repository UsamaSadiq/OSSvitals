import { describe, expect, it } from "vitest";
import { advisoryNotice, driftHeadline, forkRows, needingAttention, overviewStats, releaseGapText, severity, sortedForks, statusCounts } from "./rows";
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

describe("release gap wording", () => {
  const gap = { base: "v4.18.0", base_ref: "v26.10.0", latest: "v4.18.0", releases_behind: 0, level: "none" as const, days_behind: 0 };

  it("says when a fork is on upstream's latest release", () => {
    expect(releaseGapText(gap)).toBe("v4.18.0, upstream's latest release");
  });

  it("leads with releases behind when the base release is known, commits otherwise", () => {
    const behind = { ...gap, latest: "v4.19.1", releases_behind: 2, level: "minor" as const };
    expect(driftHeadline({ ...drift("a", "lagging", 113), release_gap: behind })).toEqual({ count: 2, text: "releases behind upstream (v4.18.0 → v4.19.1)" });
    expect(driftHeadline(drift("a", "lagging", 113))).toEqual({ count: 113, text: "commits behind upstream" });
  });

  it("does not count zero releases as drift", () => {
    expect(driftHeadline({ ...drift("a", "in-sync", 113), release_gap: gap })).toEqual({ count: 0, text: "releases behind (on upstream's latest, v4.18.0)" });
  });

  it("explains advisories by the same signal the status used", () => {
    const advisories = { published: 4, since_fork_release: 0, affecting_fork_release: 1, source: "x" };
    const onRelease = { ...drift("a", "critical", 1), status_basis: "release" as const, release_gap: gap, advisories };
    expect(advisoryNotice(onRelease)).toBe("1 upstream advisory affects v4.18.0, our base");
    expect(advisoryNotice({ ...onRelease, status_basis: "commits", release_gap: null })).toBeNull();
    expect(advisoryNotice({ ...drift("a", "critical", 1), advisories: { ...advisories, since_fork_release: 2 } })).toBe("2 new upstream advisories since our latest release");
  });

  it("breaks severity ties by releases behind before commits behind", () => {
    const rows = forkRows([app("few"), app("many")], [
      { ...drift("few", "stale", 900), release_gap: { ...gap, releases_behind: 1 } },
      { ...drift("many", "stale", 10), release_gap: { ...gap, releases_behind: 5 } },
    ]);
    expect(sortedForks(rows).map((row) => row.app.repo)).toEqual(["many", "few"]);
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

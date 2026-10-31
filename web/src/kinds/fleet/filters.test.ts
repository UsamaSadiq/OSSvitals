import { describe, expect, it } from "vitest";
import { appOptions, applyFilters, countsIgnoringStatus, hasActiveFilters, licenceOptions, parseFilters, toggledStatuses, type ForkFilters } from "./filters";
import type { ForkRow } from "./rows";

function row(repo: string, status: string, licence: string | null, advisories: number, released: boolean, staged = 0): ForkRow {
  return {
    app: {
      repo,
      class: "fork",
      url: "",
      description: null,
      licence,
      upstream: `up/${repo}`,
      upstream_url: null,
      upstream_branch: "main",
      production_branch: "foss-main",
      purpose: null,
      what_we_changed: null,
      pushed_at: "",
      open_pull_requests: 0,
      latest_tag: null,
    },
    drift: {
      repo,
      status,
      ahead_by: 0,
      behind_by: 0,
      last_upstream_merge: "",
      days_since_upstream_merge: 0,
      fork_release: released ? { tag: "v1", date: null } : null,
      upstream_release: null,
      advisories: { published: advisories, since_fork_release: advisories, source: "" },
      promotion: { unpromoted_commits: staged },
    },
  };
}

const ROWS = [
  row("alpha", "critical", "AGPL-3.0", 3, true),
  row("beta", "stale", "MIT", 0, false, 3),
  row("gamma", "stale", "MIT", 1, true),
  row("delta", "in-sync", null, 0, false),
];

const NONE: ForkFilters = { statuses: [], licence: null, advisories: false, noRelease: false, unpromoted: false, app: null };
const names = (filters: Partial<ForkFilters>) => applyFilters(ROWS, { ...NONE, ...filters }).map((r) => r.app.repo);

describe("applyFilters", () => {
  it("returns everything when nothing is selected", () => {
    expect(names({})).toEqual(["alpha", "beta", "gamma", "delta"]);
  });

  it("filters by any selected status", () => {
    expect(names({ statuses: ["stale", "in-sync"] })).toEqual(["beta", "gamma", "delta"]);
  });

  it("filters by licence, advisories and missing release", () => {
    expect(names({ licence: "MIT" })).toEqual(["beta", "gamma"]);
    expect(names({ advisories: true })).toEqual(["alpha", "gamma"]);
    expect(names({ noRelease: true })).toEqual(["beta", "delta"]);
    expect(names({ unpromoted: true })).toEqual(["beta"]);
  });

  it("filters to a single app", () => {
    expect(names({ app: "gamma" })).toEqual(["gamma"]);
    expect(names({ app: "no-such-app" })).toEqual([]);
  });

  it("combines facets", () => {
    expect(names({ statuses: ["stale"], licence: "MIT", advisories: true })).toEqual(["gamma"]);
  });
});

describe("countsIgnoringStatus", () => {
  it("counts every status under the other facets, even while a status is selected", () => {
    const counts = countsIgnoringStatus(ROWS, { ...NONE, statuses: ["critical"], licence: "MIT" });
    expect(counts).toEqual({ "in-sync": 0, lagging: 0, stale: 2, critical: 0 });
  });
});

describe("query parameters", () => {
  it("round trips the filters and drops unknown statuses", () => {
    const filters = parseFilters(new URLSearchParams("status=stale,bogus,critical&licence=MIT&advisories=1&no_release=1&unpromoted=1&app=alpha"));
    expect(filters).toEqual({ statuses: ["stale", "critical"], licence: "MIT", advisories: true, noRelease: true, unpromoted: true, app: "alpha" });
    expect(hasActiveFilters(filters)).toBe(true);
    expect(hasActiveFilters(parseFilters(new URLSearchParams("")))).toBe(false);
  });

  it("toggles a status on and off", () => {
    expect(toggledStatuses([], "stale")).toEqual(["stale"]);
    expect(toggledStatuses(["stale", "critical"], "stale")).toEqual(["critical"]);
  });
});

describe("appOptions", () => {
  it("lists each fork once, sorted", () => {
    expect(appOptions(ROWS)).toEqual(["alpha", "beta", "delta", "gamma"]);
  });
});

describe("licenceOptions", () => {
  it("lists each recorded licence once, sorted", () => {
    expect(licenceOptions(ROWS)).toEqual(["AGPL-3.0", "MIT"]);
  });
});

import { describe, expect, it } from "vitest";
import { forksCsv } from "./csv";
import type { ForkRow } from "./rows";

const ROW: ForkRow = {
  app: {
    repo: "twenty",
    class: "fork",
    url: "",
    description: null,
    licence: 'AGPL-3.0, "quoted"',
    upstream: "a/b",
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
    repo: "twenty",
    status: "critical",
    status_basis: "release",
    release_gap: { base: "twenty/v2.40.0", base_ref: "v26.10.0", latest: "twenty/v2.45.0", releases_behind: 5, level: "minor", days_behind: 30 },
    ahead_by: 47,
    behind_by: 4849,
    behind_release: 4372,
    last_upstream_merge: "2026-04-30T10:00:00Z",
    days_since_upstream_merge: 164,
    fork_release: null,
    upstream_release: { tag: "v2.45.0", date: null },
    advisories: { published: 9, since_fork_release: 5, affecting_fork_release: 2, source: "x" },
    promotion: null,
  },
};

describe("forksCsv", () => {
  it("writes a header and one escaped row per fork", () => {
    expect(forksCsv([ROW]).split("\n")).toEqual([
      "app,status,status_basis,upstream_base,upstream_latest,releases_behind,version_gap,behind_by,behind_release,ahead_by,last_upstream_sync,our_release,upstream_release,applying_advisories,licence",
      'twenty,critical,release,twenty/v2.40.0,twenty/v2.45.0,5,minor,4849,4372,47,2026-04-30,,v2.45.0,2,"AGPL-3.0, ""quoted"""',
      "",
    ]);
  });
});

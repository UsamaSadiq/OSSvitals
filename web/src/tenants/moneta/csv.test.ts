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
    ahead_by: 47,
    behind_by: 4849,
    last_upstream_merge: "2026-04-30T10:00:00Z",
    days_since_upstream_merge: 164,
    fork_release: null,
    upstream_release: { tag: "v2.45.0", date: null },
    advisories: { published: 9, since_fork_release: 2, source: "x" },
    promotion: null,
  },
};

describe("forksCsv", () => {
  it("writes a header and one escaped row per fork", () => {
    expect(forksCsv([ROW]).split("\n")).toEqual([
      "app,status,behind_by,ahead_by,last_upstream_sync,our_release,upstream_release,new_advisories,licence",
      'twenty,critical,4849,47,2026-04-30,,v2.45.0,2,"AGPL-3.0, ""quoted"""',
      "",
    ]);
  });
});

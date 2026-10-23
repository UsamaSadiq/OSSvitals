import { latest, pullRepos, pushedSince, repoOfPull, type PushedRepo } from "../src/feed.ts";

const REPOS: PushedRepo[] = [
  { name: "wg-maintenance", pushed_at: "2026-10-23T05:23:24Z" },
  { name: "edx-drf-extensions", pushed_at: "2026-10-23T04:22:09Z" },
  { name: "edx-toggles", pushed_at: "2026-10-23T03:04:51Z" },
  { name: "empty-repo", pushed_at: null },
];

describe("pushedSince", () => {
  it("lists repos pushed after the watermark", () => {
    expect(pushedSince(REPOS, "2026-10-23T04:00:00Z")).toEqual(["edx-drf-extensions", "wg-maintenance"]);
  });

  it("excludes a push exactly at the watermark", () => {
    expect(pushedSince(REPOS, "2026-10-23T05:23:24Z")).toEqual([]);
  });
});

describe("pull items", () => {
  const item = (repo: string) => ({
    repository_url: `https://api.github.com/repos/openedx/${repo}`,
    updated_at: "2026-10-23T06:03:35Z",
  });

  it("names the repo from its API url", () => {
    expect(repoOfPull(item("tutor-contrib-aspects"))).toBe("tutor-contrib-aspects");
  });

  it("lists each repo once", () => {
    expect(pullRepos([item("b"), item("a"), item("b")])).toEqual(["a", "b"]);
  });
});

describe("latest", () => {
  it("picks the newest time and skips nulls", () => {
    expect(latest(REPOS.map((repo) => repo.pushed_at), null)).toBe("2026-10-23T05:23:24Z");
  });

  it("keeps the fallback when nothing is newer", () => {
    expect(latest([], "2026-10-23T06:00:00Z")).toBe("2026-10-23T06:00:00Z");
    expect(latest(["2026-10-23T01:00:00Z"], "2026-10-23T06:00:00Z")).toBe("2026-10-23T06:00:00Z");
  });
});

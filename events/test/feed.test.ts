import { advance, isUnseen, latest, pullRepos, pushedSince, repoOfPull, type PushedRepo } from "../src/feed.ts";

const REPOS: PushedRepo[] = [
  { name: "wg-maintenance", pushed_at: "2026-10-23T05:23:24Z" },
  { name: "edx-drf-extensions", pushed_at: "2026-10-23T04:22:09Z" },
  { name: "edx-toggles", pushed_at: "2026-10-23T03:04:51Z" },
  { name: "empty-repo", pushed_at: null },
];

describe("pushedSince", () => {
  it("lists repos pushed after the watermark", () => {
    expect(pushedSince(REPOS, { time: "2026-10-23T04:00:00Z", seen: [] })).toEqual(["edx-drf-extensions", "wg-maintenance"]);
  });

  it("excludes a push exactly at the watermark that was already seen", () => {
    expect(pushedSince(REPOS, { time: "2026-10-23T05:23:24Z", seen: ["wg-maintenance"] })).toEqual([]);
  });

  it("includes a push in the same second as the watermark that was not seen", () => {
    expect(pushedSince(REPOS, { time: "2026-10-23T05:23:24Z", seen: ["other"] })).toEqual(["wg-maintenance"]);
  });
});

describe("pull items", () => {
  const item = (repo: string, id = 1) => ({
    id,
    repository_url: `https://api.github.com/repos/openedx/${repo}`,
    updated_at: "2026-10-23T06:03:35Z",
  });

  it("names the repo from its API url", () => {
    expect(repoOfPull(item("tutor-contrib-aspects"))).toBe("tutor-contrib-aspects");
  });

  it("lists each repo once", () => {
    expect(pullRepos([item("b", 1), item("a", 2), item("b", 3)], { time: "2026-10-23T06:00:00Z", seen: [] })).toEqual(["a", "b"]);
  });

  it("skips pulls already seen at the watermark second but not new ones in the same repo", () => {
    const mark = { time: "2026-10-23T06:03:35Z", seen: ["1"] };
    expect(pullRepos([item("a", 1)], mark)).toEqual([]);
    expect(pullRepos([item("a", 1), item("a", 2)], mark)).toEqual(["a"]);
  });
});

describe("watermark", () => {
  const at = (time: string, key: string) => ({ time, key });

  it("never reports anything before a watermark exists", () => {
    expect(isUnseen(at("2026-10-23T05:00:00Z", "a"), { time: null, seen: [] })).toBe(false);
  });

  it("remembers every key at the newest instant", () => {
    const mark = advance([at("2026-10-23T05:00:00Z", "b"), at("2026-10-23T05:00:00Z", "a"), at("2026-10-23T04:00:00Z", "c")], { time: null, seen: [] });
    expect(mark).toEqual({ time: "2026-10-23T05:00:00Z", seen: ["a", "b"] });
  });

  it("carries seen keys forward while the instant is unchanged and resets when it advances", () => {
    const start = { time: "2026-10-23T05:00:00Z", seen: ["a"] };
    expect(advance([at("2026-10-23T05:00:00Z", "b")], start).seen).toEqual(["a", "b"]);
    expect(advance([at("2026-10-23T06:00:00Z", "c")], start)).toEqual({ time: "2026-10-23T06:00:00Z", seen: ["c"] });
    expect(advance([], start)).toEqual(start);
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

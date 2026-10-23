import type { PullItem, PushedRepo } from "../src/feed.ts";
import type { GitHubClient, RepoList } from "../src/github.ts";
import { EMPTY_STATE, stateStore, type StateBucket, type WatchState } from "../src/state.ts";
import { tick, type TickConfig } from "../src/tick.ts";

const NOW = new Date("2026-10-23T06:30:00Z");
const CONFIG: TickConfig = { minDispatchGapMs: 5 * 60_000, maxReposPerDispatch: 2 };
const SEEN = "2026-10-23T06:00:00Z";
const WATCHING: WatchState = { ...EMPTY_STATE, reposEtag: '"e1"', pushedSince: SEEN, pullsUpdatedSince: SEEN };

function pushed(name: string, at: string): PushedRepo {
  return { name, pushed_at: at };
}

function pull(repo: string, at: string): PullItem {
  return { repository_url: `https://api.github.com/repos/openedx/${repo}`, updated_at: at };
}

interface Fake {
  repos?: RepoList;
  pulls?: PullItem[];
  busy?: boolean;
}

function fakeGitHub({ repos = { status: "unchanged" }, pulls = [], busy = false }: Fake): GitHubClient & { dispatched: string[][] } {
  const dispatched: string[][] = [];
  return {
    dispatched,
    pushedRepos: async () => repos,
    updatedPulls: async () => pulls,
    workflowBusy: async () => busy,
    dispatch: async (names) => {
      dispatched.push([...names]);
    },
  };
}

function memoryBucket(initial?: WatchState): StateBucket & { saved: WatchState[] } {
  const saved: WatchState[] = [];
  let stored = initial === undefined ? null : JSON.stringify(initial);
  return {
    saved,
    get: async () => (stored === null ? null : { text: async () => stored! }),
    put: async (_key, value) => {
      stored = value;
      saved.push(JSON.parse(value) as WatchState);
    },
  };
}

function run(github: GitHubClient, bucket: StateBucket) {
  return tick({ github, store: stateStore(bucket), config: CONFIG, now: NOW });
}

describe("tick", () => {
  it("only records watermarks on its first run", async () => {
    const github = fakeGitHub({
      repos: { status: "changed", etag: '"e2"', repos: [pushed("edx-platform", "2026-10-23T06:20:00Z")] },
      pulls: [pull("credentials", "2026-10-23T06:25:00Z")],
    });
    const bucket = memoryBucket();
    const { state, dispatched } = await run(github, bucket);
    expect(dispatched).toEqual([]);
    expect(state).toMatchObject({
      reposEtag: '"e2"',
      pushedSince: "2026-10-23T06:20:00Z",
      pullsUpdatedSince: "2026-10-23T06:25:00Z",
      pending: [],
    });
    expect(bucket.saved).toHaveLength(1);
  });

  it("dispatches repos pushed or with PRs updated since the watermarks", async () => {
    const github = fakeGitHub({
      repos: {
        status: "changed",
        etag: '"e2"',
        repos: [pushed("edx-platform", "2026-10-23T06:20:00Z"), pushed("old", "2026-10-23T05:00:00Z")],
      },
      pulls: [pull("credentials", "2026-10-23T06:25:00Z"), pull("edx-platform", "2026-10-23T06:10:00Z")],
    });
    const { state, dispatched } = await run(github, memoryBucket(WATCHING));
    expect(dispatched).toEqual(["credentials", "edx-platform"]);
    expect(state).toMatchObject({
      pushedSince: "2026-10-23T06:20:00Z",
      pullsUpdatedSince: "2026-10-23T06:25:00Z",
      pending: [],
      lastDispatchAt: NOW.toISOString(),
    });
  });

  it("holds repos while the workflow is busy", async () => {
    const github = fakeGitHub({ pulls: [pull("edx-platform", "2026-10-23T06:25:00Z")], busy: true });
    const { state, dispatched } = await run(github, memoryBucket(WATCHING));
    expect(dispatched).toEqual([]);
    expect(state.pending).toEqual(["edx-platform"]);
  });

  it("waits out the gap since the last dispatch", async () => {
    const recent = new Date(NOW.getTime() - 60_000).toISOString();
    const bucket = memoryBucket({ ...WATCHING, pending: ["a"], lastDispatchAt: recent });
    expect((await run(fakeGitHub({}), bucket)).dispatched).toEqual([]);
  });

  it("sends at most the batch size and keeps the rest pending", async () => {
    const { state, dispatched } = await run(fakeGitHub({}), memoryBucket({ ...WATCHING, pending: ["a", "b", "c"] }));
    expect(dispatched).toEqual(["a", "b"]);
    expect(state.pending).toEqual(["c"]);
  });

  it("keeps found repos pending and moves the watermarks when the dispatch is rejected", async () => {
    const github = {
      ...fakeGitHub({ pulls: [pull("edx-platform", "2026-10-23T06:25:00Z")] }),
      dispatch: async () => {
        throw new Error("GitHub 422");
      },
    };
    const bucket = memoryBucket(WATCHING);
    await expect(run(github, bucket)).rejects.toThrow("GitHub 422");
    expect(bucket.saved.at(-1)).toMatchObject({ pending: ["edx-platform"], pullsUpdatedSince: "2026-10-23T06:25:00Z" });
  });

  it("saves nothing when it sees nothing new", async () => {
    const bucket = memoryBucket(WATCHING);
    const { dispatched } = await run(fakeGitHub({}), bucket);
    expect(dispatched).toEqual([]);
    expect(bucket.saved).toHaveLength(0);
  });
});

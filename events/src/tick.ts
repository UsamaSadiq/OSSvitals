import { latest, pullRepos, pushedSince } from "./feed.ts";
import type { GitHubClient } from "./github.ts";
import type { StateStore, WatchState } from "./state.ts";

export interface TickConfig {
  minDispatchGapMs: number;
  maxReposPerDispatch: number;
}

export interface TickDeps {
  github: GitHubClient;
  store: StateStore;
  config: TickConfig;
  now: Date;
}

export interface TickOutcome {
  state: WatchState;
  dispatched: string[];
}

interface Polled {
  state: WatchState;
  found: string[];
}

function union(current: readonly string[], found: readonly string[]): string[] {
  return [...new Set([...current, ...found])].sort();
}

function elapsedMs(since: string | null, now: Date): number {
  return since === null ? Number.POSITIVE_INFINITY : now.getTime() - Date.parse(since);
}

async function pollPushes(state: WatchState, github: GitHubClient): Promise<Polled> {
  const list = await github.pushedRepos(state.reposEtag, state.pushedSince);
  if (list.status === "unchanged") return { state, found: [] };
  const found = state.pushedSince === null ? [] : pushedSince(list.repos, state.pushedSince);
  const watermark = latest(list.repos.map((repo) => repo.pushed_at), state.pushedSince);
  return { state: { ...state, reposEtag: list.etag, pushedSince: watermark }, found };
}

async function pollPulls(state: WatchState, github: GitHubClient): Promise<Polled> {
  const items = await github.updatedPulls(state.pullsUpdatedSince);
  const found = state.pullsUpdatedSince === null ? [] : pullRepos(items);
  const watermark = latest(items.map((item) => item.updated_at), state.pullsUpdatedSince);
  return { state: { ...state, pullsUpdatedSince: watermark }, found };
}

async function poll(state: WatchState, github: GitHubClient): Promise<WatchState> {
  const pushes = await pollPushes(state, github);
  const pulls = await pollPulls(pushes.state, github);
  return { ...pulls.state, pending: union(state.pending, [...pushes.found, ...pulls.found]) };
}

async function readyToDispatch(state: WatchState, { github, config, now }: TickDeps): Promise<boolean> {
  if (state.pending.length === 0) return false;
  if (elapsedMs(state.lastDispatchAt, now) < config.minDispatchGapMs) return false;
  return !(await github.workflowBusy());
}

function sameState(left: WatchState, right: WatchState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function tick(deps: TickDeps): Promise<TickOutcome> {
  const before = await deps.store.load();
  const polled = await poll(before, deps.github);
  if (!sameState(before, polled)) await deps.store.save(polled);
  if (!(await readyToDispatch(polled, deps))) return { state: polled, dispatched: [] };
  const batch = polled.pending.slice(0, deps.config.maxReposPerDispatch);
  await deps.github.dispatch(batch);
  const after = { ...polled, pending: polled.pending.slice(batch.length), lastDispatchAt: deps.now.toISOString() };
  await deps.store.save(after);
  return { state: after, dispatched: batch };
}

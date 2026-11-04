import { gitHubClient } from "./github.ts";
import { stateStore, type StateBucket } from "./state.ts";
import { tick } from "./tick.ts";

const MAX_REPOS_PER_DISPATCH = 50;
const MS_PER_MINUTE = 60_000;
const DEFAULT_DISPATCH_GAP_MINUTES = 5;

interface Env {
  STATE: StateBucket;
  GITHUB_TOKEN: string;
  ORG?: string;
  TARGET_REPO: string;
  WORKFLOW: string;
  REF: string;
  MIN_DISPATCH_GAP_MINUTES?: string;
}

interface ScheduledEvent {
  scheduledTime: number;
}

const ORG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function parseOrg(value: string | undefined): string {
  const org = value ?? "openedx";
  if (!ORG_PATTERN.test(org)) throw new Error(`ORG must be a lowercase tenant slug, got "${org}"`);
  return org;
}

export function parseGapMs(minutes: string | undefined): number {
  const parsed = minutes === undefined || minutes.trim() === "" ? DEFAULT_DISPATCH_GAP_MINUTES : Number(minutes);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`MIN_DISPATCH_GAP_MINUTES must be a non-negative number, got "${minutes}"`);
  return parsed * MS_PER_MINUTE;
}

async function run(env: Env, now: Date): Promise<void> {
  const { state, dispatched } = await tick({
    github: gitHubClient({
      fetch: (input, init) => fetch(input, init),
      token: env.GITHUB_TOKEN,
      org: parseOrg(env.ORG),
      targetRepo: env.TARGET_REPO,
      workflow: env.WORKFLOW,
      ref: env.REF,
    }),
    store: stateStore(env.STATE),
    config: {
      minDispatchGapMs: parseGapMs(env.MIN_DISPATCH_GAP_MINUTES),
      maxReposPerDispatch: MAX_REPOS_PER_DISPATCH,
    },
    now,
  });
  console.log(JSON.stringify({ dispatched, pending: state.pending, pushedSince: state.pushedSince, pullsUpdatedSince: state.pullsUpdatedSince }));
}

export default {
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    await run(env, new Date(event.scheduledTime));
  },
};

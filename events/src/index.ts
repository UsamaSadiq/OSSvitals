import { gitHubClient } from "./github.ts";
import { stateStore, type StateBucket } from "./state.ts";
import { tick } from "./tick.ts";

const MAX_REPOS_PER_DISPATCH = 50;
const MS_PER_MINUTE = 60_000;

interface Env {
  STATE: StateBucket;
  GITHUB_TOKEN: string;
  ORG: string;
  TARGET_REPO: string;
  WORKFLOW: string;
  REF: string;
  MIN_DISPATCH_GAP_MINUTES: string;
}

interface ScheduledEvent {
  scheduledTime: number;
}

async function run(env: Env, now: Date): Promise<void> {
  const { state, dispatched } = await tick({
    github: gitHubClient({
      fetch: (input, init) => fetch(input, init),
      token: env.GITHUB_TOKEN,
      org: env.ORG,
      targetRepo: env.TARGET_REPO,
      workflow: env.WORKFLOW,
      ref: env.REF,
    }),
    store: stateStore(env.STATE),
    config: {
      minDispatchGapMs: Number(env.MIN_DISPATCH_GAP_MINUTES) * MS_PER_MINUTE,
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

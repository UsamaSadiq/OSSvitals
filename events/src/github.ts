import { isLater, type PullItem, type PushedRepo } from "./feed.ts";

const API = "https://api.github.com";
const PER_PAGE = 100;
const MAX_PAGES = 3;
const RECENT_RUNS = 20;

export type RepoList = { status: "unchanged" } | { status: "changed"; etag: string | null; repos: PushedRepo[] };

export interface GitHubClient {
  pushedRepos(etag: string | null, since: string | null): Promise<RepoList>;
  updatedPulls(since: string | null): Promise<PullItem[]>;
  workflowBusy(): Promise<boolean>;
  dispatch(repos: readonly string[]): Promise<void>;
}

export interface GitHubOptions {
  fetch: typeof fetch;
  token: string;
  org: string;
  targetRepo: string;
  workflow: string;
  ref: string;
}

interface SearchResult {
  items: PullItem[];
}

interface WorkflowRuns {
  workflow_runs: { status: string }[];
}

function allLater(repos: readonly PushedRepo[], since: string | null): boolean {
  const oldest = repos.at(-1)?.pushed_at;
  return since !== null && oldest != null && isLater(oldest, since);
}

export function pullQuery(org: string, since: string | null): string {
  return since === null ? `org:${org} is:pr` : `org:${org} is:pr updated:>${since}`;
}

export function gitHubClient(options: GitHubOptions): GitHubClient {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${options.token}`,
    "User-Agent": "ossvitals-events",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const workflowUrl = `${API}/repos/${options.targetRepo}/actions/workflows/${options.workflow}`;

  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await options.fetch(url, { ...init, headers: { ...headers, ...init.headers } });
    if (!response.ok && response.status !== 304) throw new Error(`GitHub ${response.status} for ${url}`);
    return response;
  }

  function reposUrl(page: number): string {
    return `${API}/orgs/${options.org}/repos?sort=pushed&direction=desc&per_page=${PER_PAGE}&page=${page}`;
  }

  function searchUrl(since: string | null, page: number): string {
    const size = since === null ? 1 : PER_PAGE;
    const query = encodeURIComponent(pullQuery(options.org, since));
    return `${API}/search/issues?q=${query}&sort=updated&order=desc&per_page=${size}&page=${page}`;
  }

  async function morePushed(first: PushedRepo[], since: string | null): Promise<PushedRepo[]> {
    const repos = [...first];
    let page = first;
    for (let number = 2; number <= MAX_PAGES && page.length === PER_PAGE && allLater(page, since); number++) {
      page = (await (await request(reposUrl(number))).json()) as PushedRepo[];
      repos.push(...page);
    }
    return repos;
  }

  return {
    async pushedRepos(etag, since) {
      const response = await request(reposUrl(1), { headers: etag ? { "If-None-Match": etag } : {} });
      if (response.status === 304) return { status: "unchanged" };
      const first = (await response.json()) as PushedRepo[];
      return { status: "changed", etag: response.headers.get("ETag"), repos: await morePushed(first, since) };
    },

    async updatedPulls(since) {
      const items: PullItem[] = [];
      for (let number = 1; number <= MAX_PAGES; number++) {
        const page = ((await (await request(searchUrl(since, number))).json()) as SearchResult).items;
        items.push(...page);
        if (since === null || page.length < PER_PAGE) break;
      }
      return items;
    },

    async workflowBusy() {
      const runs = (await (await request(`${workflowUrl}/runs?per_page=${RECENT_RUNS}`)).json()) as WorkflowRuns;
      return runs.workflow_runs.some((run) => run.status !== "completed");
    },

    async dispatch(repos) {
      await request(`${workflowUrl}/dispatches`, {
        method: "POST",
        body: JSON.stringify({ ref: options.ref, inputs: { repos: repos.join(" ") } }),
      });
    },
  };
}

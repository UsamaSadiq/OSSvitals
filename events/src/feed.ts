export interface PushedRepo {
  name: string;
  pushed_at: string | null;
}

export interface PullItem {
  repository_url: string;
  updated_at: string;
}

export function isLater(time: string, than: string): boolean {
  return Date.parse(time) > Date.parse(than);
}

export function latest(times: readonly (string | null)[], fallback: string | null): string | null {
  return times.reduce<string | null>(
    (newest, time) => (time !== null && (newest === null || isLater(time, newest)) ? time : newest),
    fallback,
  );
}

function sortedUnique(names: readonly string[]): string[] {
  return [...new Set(names)].sort();
}

export function pushedSince(repos: readonly PushedRepo[], since: string): string[] {
  return sortedUnique(repos.filter((repo) => repo.pushed_at !== null && isLater(repo.pushed_at, since)).map((repo) => repo.name));
}

export function repoOfPull(item: PullItem): string {
  return item.repository_url.slice(item.repository_url.lastIndexOf("/") + 1);
}

export function pullRepos(items: readonly PullItem[]): string[] {
  return sortedUnique(items.map(repoOfPull));
}

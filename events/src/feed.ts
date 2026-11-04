export interface PushedRepo {
  name: string;
  pushed_at: string | null;
}

export interface PullItem {
  id: number;
  repository_url: string;
  updated_at: string;
}

export function isLater(time: string, than: string): boolean {
  return Date.parse(time) > Date.parse(than);
}

export function isAtOrAfter(time: string, than: string): boolean {
  return Date.parse(time) >= Date.parse(than);
}

function isSameInstant(time: string, than: string): boolean {
  return Date.parse(time) === Date.parse(than);
}

export interface Watermark {
  time: string | null;
  seen: readonly string[];
}

export interface Stamped {
  time: string | null;
  key: string;
}

export function isUnseen(item: Stamped, mark: Watermark): boolean {
  if (item.time === null || mark.time === null) return false;
  if (isLater(item.time, mark.time)) return true;
  return isSameInstant(item.time, mark.time) && !mark.seen.includes(item.key);
}

export function advance(items: readonly Stamped[], mark: Watermark): Watermark {
  const time = latest(items.map((item) => item.time), mark.time);
  if (time === null) return mark;
  const atTime = items.filter((item) => item.time !== null && isSameInstant(item.time, time)).map((item) => item.key);
  const carried = mark.time !== null && isSameInstant(time, mark.time) ? mark.seen : [];
  return { time, seen: sortedUnique([...carried, ...atTime]) };
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

export function pushStamps(repos: readonly PushedRepo[]): Stamped[] {
  return repos.map((repo) => ({ time: repo.pushed_at, key: repo.name }));
}

export function pullStamps(items: readonly PullItem[]): Stamped[] {
  return items.map((item) => ({ time: item.updated_at, key: String(item.id) }));
}

export function pushedSince(repos: readonly PushedRepo[], mark: Watermark): string[] {
  return sortedUnique(pushStamps(repos).filter((stamp) => isUnseen(stamp, mark)).map((stamp) => stamp.key));
}

export function repoOfPull(item: PullItem): string {
  return item.repository_url.slice(item.repository_url.lastIndexOf("/") + 1);
}

export function pullRepos(items: readonly PullItem[], mark: Watermark): string[] {
  return sortedUnique(items.filter((item) => isUnseen(pullStamps([item])[0]!, mark)).map(repoOfPull));
}

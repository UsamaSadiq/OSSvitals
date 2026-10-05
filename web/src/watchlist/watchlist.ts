export const WATCHLIST_KEY = "ossvitals-watchlist";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type Watchlist = readonly string[];

const EMPTY: Watchlist = Object.freeze([]);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseWatchlist(text: string | null): Watchlist {
  if (!text) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(text);
    return isStringArray(parsed) ? [...new Set(parsed)] : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function toggledWatchlist(list: Watchlist, repo: string): Watchlist {
  return list.includes(repo) ? list.filter((name) => name !== repo) : [...list, repo];
}

function readStored(storage: () => KeyValueStorage | null): Watchlist {
  try {
    return parseWatchlist(storage()?.getItem(WATCHLIST_KEY) ?? null);
  } catch {
    return EMPTY;
  }
}

function writeStored(storage: () => KeyValueStorage | null, list: Watchlist): void {
  try {
    storage()?.setItem(WATCHLIST_KEY, JSON.stringify(list));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the list still holds for this page view.
  }
}

export interface WatchlistStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Watchlist;
  toggle(repo: string): void;
  reload(): void;
}

export function createWatchlistStore(storage: () => KeyValueStorage | null): WatchlistStore {
  const listeners = new Set<() => void>();
  let current: Watchlist | null = null;
  const publish = (next: Watchlist) => {
    current = next;
    listeners.forEach((listener) => listener());
  };
  const getSnapshot = () => {
    current ??= readStored(storage);
    return current;
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot,
    toggle(repo) {
      const next = toggledWatchlist(getSnapshot(), repo);
      writeStored(storage, next);
      publish(next);
    },
    reload() {
      publish(readStored(storage));
    },
  };
}

function browserStorage(): KeyValueStorage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export const watchlistStore = createWatchlistStore(browserStorage);

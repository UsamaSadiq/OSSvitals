import { useEffect, useSyncExternalStore } from "react";
import { WATCHLIST_KEY, watchlistStore, type Watchlist } from "./watchlist";

function useCrossTabSync(): void {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === WATCHLIST_KEY) watchlistStore.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

export function useWatchlist(): Watchlist {
  useCrossTabSync();
  return useSyncExternalStore(watchlistStore.subscribe, () => watchlistStore.getSnapshot());
}

export function useIsWatched(repo: string): boolean {
  return useWatchlist().includes(repo);
}

export function toggleWatched(repo: string): void {
  watchlistStore.toggle(repo);
}

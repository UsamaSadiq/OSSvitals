const RELOADED_KEY = "ossvitals:reloaded-for";

const STALE_CHUNK_MESSAGES = [
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
  "is not a valid JavaScript MIME type",
];

/** A page chunk from an earlier deploy: the tab still runs the old build, whose hashed files are gone. */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return STALE_CHUNK_MESSAGES.some((text) => message.includes(text));
}

interface ReloadTarget {
  href: string;
  reload: () => void;
}

/**
 * Reload once per address to pick up the new build. The guard stops a loop when the chunk is missing for another
 * reason; storage can be unavailable (private mode), in which case no reload is attempted.
 */
export function reloadOnce(storage: Storage | undefined, target: ReloadTarget): boolean {
  try {
    if (!storage || storage.getItem(RELOADED_KEY) === target.href) return false;
    storage.setItem(RELOADED_KEY, target.href);
  } catch {
    return false;
  }
  target.reload();
  return true;
}

function sessionStore(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function reloadForNewBuild(): boolean {
  return reloadOnce(sessionStore(), { href: window.location.href, reload: () => window.location.reload() });
}

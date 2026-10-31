import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTenant } from "../../tenants/context";
import type { FleetManifest } from "./schemas";
import type { SignalKey, Surface } from "./signals";
import { useFleetViews } from "./useFleetViews";

export interface SignalVisibility {
  manifest: FleetManifest | null;
  hiddenByViewer: ReadonlySet<string>;
  isShown: (key: SignalKey, surface: Surface) => boolean;
  setHiddenByViewer: (key: SignalKey, hidden: boolean) => void;
  resetViewer: () => void;
}

/** Without a manifest (data published before it, or unreadable) everything is shown and the viewer's choices wait for it to return. */
export function isShownBy(manifest: FleetManifest | null, hiddenByViewer: ReadonlySet<string>, key: SignalKey, surface: Surface): boolean {
  if (!manifest) return true;
  if (hiddenByViewer.has(key)) return false;
  const signal = manifest.signals[key];
  return Boolean(signal?.collect && signal.show.includes(surface));
}

export function storageKey(org: string): string {
  return `ossvitals:${org}:hidden-signals`;
}

function readHidden(org: string): ReadonlySet<string> {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey(org)) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set();
  }
}

function writeHidden(org: string, hidden: ReadonlySet<string>): void {
  try {
    if (hidden.size === 0) window.localStorage.removeItem(storageKey(org));
    else window.localStorage.setItem(storageKey(org), JSON.stringify([...hidden].sort()));
  } catch {
    // A viewer without storage keeps their choice for this visit only.
  }
}

const SHOW_ALL: SignalVisibility = {
  manifest: null,
  hiddenByViewer: new Set(),
  isShown: () => true,
  setHiddenByViewer: () => undefined,
  resetViewer: () => undefined,
};

const SignalVisibilityContext = createContext<SignalVisibility>(SHOW_ALL);

export function SignalVisibilityProvider({ children }: { children: ReactNode }) {
  const { org } = useTenant();
  const views = useFleetViews();
  const manifest = views.status === "ready" ? (views.meta?.fleet ?? null) : null;
  const [hiddenByViewer, setHidden] = useState(() => readHidden(org));
  const setHiddenByViewer = useCallback(
    (key: SignalKey, hidden: boolean) =>
      setHidden((current) => {
        const next = new Set(current);
        if (hidden) next.add(key);
        else next.delete(key);
        writeHidden(org, next);
        return next;
      }),
    [org],
  );
  const resetViewer = useCallback(() => {
    writeHidden(org, new Set());
    setHidden(new Set());
  }, [org]);
  const value = useMemo<SignalVisibility>(
    () => ({
      manifest,
      hiddenByViewer,
      isShown: (key, surface) => isShownBy(manifest, hiddenByViewer, key, surface),
      setHiddenByViewer,
      resetViewer,
    }),
    [manifest, hiddenByViewer, setHiddenByViewer, resetViewer],
  );
  return <SignalVisibilityContext value={value}>{children}</SignalVisibilityContext>;
}

/** Every page reads signal visibility through this hook, so the Signals panel and the pages always agree. */
export function useSignalVisibility(): SignalVisibility {
  return useContext(SignalVisibilityContext);
}

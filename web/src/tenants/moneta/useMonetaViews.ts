import { useEffect, useState } from "react";
import type { ZodType } from "zod";
import { fetchDataJson } from "../../data/load";
import {
  appsSchema,
  conflictsSchema,
  driftSchema,
  historySchema,
  updatesSchema,
  type AppsView,
  type ConflictsView,
  type DriftView,
  type HistoryView,
  type UpdatesView,
} from "./schemas";

export interface MonetaViews {
  apps: AppsView;
  drift: DriftView;
  history: HistoryView | null;
  updates: UpdatesView | null;
  conflicts: ConflictsView | null;
}

export type MonetaState = { status: "loading" } | ({ status: "ready" } & MonetaViews) | { status: "error"; message: string };

let pending: Promise<MonetaViews> | null = null;

async function fetchRequired<T>(file: string, schema: ZodType<T>): Promise<T> {
  return schema.parse(await fetchDataJson(`moneta/views/${file}`, file));
}

async function fetchOptional<T>(file: string, schema: ZodType<T>): Promise<T | null> {
  try {
    return await fetchRequired(file, schema);
  } catch {
    return null;
  }
}

async function loadViews(): Promise<MonetaViews> {
  const [apps, drift, history, updates, conflicts] = await Promise.all([
    fetchRequired("apps.json", appsSchema),
    fetchRequired("drift.json", driftSchema),
    fetchOptional("drift_history.json", historySchema),
    fetchOptional("updates.json", updatesSchema),
    fetchOptional("conflicts.json", conflictsSchema),
  ]);
  return { apps, drift, history, updates, conflicts };
}

export function clearMonetaViews(): void {
  pending = null;
}

function cachedViews(): Promise<MonetaViews> {
  if (!pending) {
    pending = loadViews();
    pending.catch(clearMonetaViews);
  }
  return pending;
}

export function useMonetaViews(): MonetaState {
  const [state, setState] = useState<MonetaState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    cachedViews().then(
      (views) => active && setState({ status: "ready", ...views }),
      (error: unknown) => active && setState({ status: "error", message: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}

import { useEffect, useState } from "react";
import type { ZodType } from "zod";
import { fetchDataJson } from "../../data/load";
import { useTenant } from "../../tenants/context";
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

export interface FleetViews {
  apps: AppsView;
  drift: DriftView;
  history: HistoryView | null;
  updates: UpdatesView | null;
  conflicts: ConflictsView | null;
}

export type FleetState = { status: "loading" } | ({ status: "ready" } & FleetViews) | { status: "error"; message: string };

const pending = new Map<string, Promise<FleetViews>>();

async function fetchRequired<T>(org: string, file: string, schema: ZodType<T>): Promise<T> {
  return schema.parse(await fetchDataJson(org, file));
}

async function fetchOptional<T>(org: string, file: string, schema: ZodType<T>): Promise<T | null> {
  try {
    return await fetchRequired(org, file, schema);
  } catch {
    return null;
  }
}

async function loadViews(org: string): Promise<FleetViews> {
  const [apps, drift, history, updates, conflicts] = await Promise.all([
    fetchRequired(org, "apps.json", appsSchema),
    fetchRequired(org, "drift.json", driftSchema),
    fetchOptional(org, "drift_history.json", historySchema),
    fetchOptional(org, "updates.json", updatesSchema),
    fetchOptional(org, "conflicts.json", conflictsSchema),
  ]);
  return { apps, drift, history, updates, conflicts };
}

export function clearFleetViews(): void {
  pending.clear();
}

function cachedViews(org: string): Promise<FleetViews> {
  const cached = pending.get(org);
  if (cached) return cached;
  const loading = loadViews(org);
  pending.set(org, loading);
  loading.catch(() => pending.delete(org));
  return loading;
}

export function useFleetViews(): FleetState {
  const { org } = useTenant();
  const [state, setState] = useState<FleetState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    cachedViews(org).then(
      (views) => active && setState({ status: "ready", ...views }),
      (error: unknown) => active && setState({ status: "error", message: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      active = false;
    };
  }, [org]);
  return state;
}

import { useEffect, useState } from "react";
import { fetchDataJson } from "../../data/load";
import { useTenant } from "../../tenants/context";
import { PINS_PATH } from "./paths";
import {
  FLEET_VIEWS,
  type AppsView,
  type CarriedView,
  type UpgradeView,
  type ConflictsView,
  type DriftView,
  type FleetMetaView,
  type HistoryView,
  type PinsView,
  type UpdatesView,
  type ViewSpec,
} from "./schemas";

export interface FleetViews {
  apps: AppsView;
  drift: DriftView;
  history: HistoryView | null;
  updates: UpdatesView | null;
  conflicts: ConflictsView | null;
  carried: CarriedView | null;
  upgrade: UpgradeView | null;
  pins: PinsView | null;
  meta: FleetMetaView | null;
}

export type FleetState = { status: "loading" } | ({ status: "ready" } & FleetViews) | { status: "error"; message: string };

const pending = new Map<string, Promise<FleetViews>>();

async function fetchView<T>(org: string, view: ViewSpec<T, true>): Promise<T>;
async function fetchView<T>(org: string, view: ViewSpec<T, false>): Promise<T | null>;
async function fetchView<T>(org: string, view: ViewSpec<T>): Promise<T | null> {
  try {
    return view.schema.parse(await fetchDataJson(org, view.file));
  } catch (error) {
    if (view.required) throw error;
    return null;
  }
}

// The collector lists the Pins page only for a tenant that pins an app, so no other tenant asks for a file it never publishes.
async function pinsListedIn(meta: Promise<FleetMetaView | null>, org: string): Promise<PinsView | null> {
  return (await meta)?.pages?.includes(PINS_PATH) ? fetchView(org, FLEET_VIEWS.pins) : null;
}

async function loadViews(org: string): Promise<FleetViews> {
  const metaView = fetchView(org, FLEET_VIEWS.meta);
  const [apps, drift, history, updates, conflicts, meta, carried, upgrade, pins] = await Promise.all([
    fetchView(org, FLEET_VIEWS.apps),
    fetchView(org, FLEET_VIEWS.drift),
    fetchView(org, FLEET_VIEWS.history),
    fetchView(org, FLEET_VIEWS.updates),
    fetchView(org, FLEET_VIEWS.conflicts),
    metaView,
    fetchView(org, FLEET_VIEWS.carried),
    fetchView(org, FLEET_VIEWS.upgrade),
    pinsListedIn(metaView, org),
  ]);
  return { apps, drift, history, updates, conflicts, meta, carried, upgrade, pins };
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

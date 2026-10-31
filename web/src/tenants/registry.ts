import index from "../../../dashboard/config/tenants.json";
import { fleetTenant } from "../kinds/fleet";
import { openedxTenant } from "./openedx";
import type { Tenant } from "./types";

export type TenantKind = "health" | "fleet";
export type TenantIndex = Readonly<Record<string, { kind: TenantKind; site: string }>>;

const BUILD_BY_KIND: Record<TenantKind, (org: string) => Tenant> = {
  // openedx is the only health tenant; its module is not parameterised by org yet.
  health: () => openedxTenant,
  fleet: fleetTenant,
};

export function buildRegistry(tenants: TenantIndex): (org: string) => Tenant {
  const built = new Map(Object.entries(tenants).map(([org, { kind }]) => [org, BUILD_BY_KIND[kind](org)]));
  return (org) => built.get(org) ?? openedxTenant;
}

export const tenantFor = buildRegistry(index as TenantIndex);

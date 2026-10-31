import index from "../../../dashboard/config/tenants.json";
import { fleetTenant } from "../kinds/fleet";
import { healthTenant } from "../kinds/health";
import { FALLBACK_ORG } from "../data/org";
import type { Tenant } from "./types";

export type TenantKind = "health" | "fleet";
export type TenantIndex = Readonly<Record<string, { kind: TenantKind; site: string }>>;

const BUILD_BY_KIND: Record<TenantKind, (org: string) => Tenant> = {
  health: healthTenant,
  fleet: fleetTenant,
};

export function buildRegistry(tenants: TenantIndex): (org: string) => Tenant {
  const built = new Map(Object.entries(tenants).map(([org, { kind }]) => [org, BUILD_BY_KIND[kind](org)]));
  const fallback = built.get(FALLBACK_ORG) ?? healthTenant(FALLBACK_ORG);
  return (org) => built.get(org) ?? fallback;
}

export const tenantFor = buildRegistry(index as TenantIndex);

import { fleetTenant } from "../kinds/fleet";
import { openedxTenant } from "./openedx";
import type { Tenant } from "./types";

const TENANTS: Record<string, Tenant> = {
  [openedxTenant.org]: openedxTenant,
  moneta: fleetTenant("moneta"),
};

export function tenantFor(org: string): Tenant {
  return TENANTS[org] ?? openedxTenant;
}

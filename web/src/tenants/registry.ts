import { monetaTenant } from "./moneta";
import { openedxTenant } from "./openedx";
import type { Tenant } from "./types";

const TENANTS: Record<string, Tenant> = {
  [openedxTenant.org]: openedxTenant,
  [monetaTenant.org]: monetaTenant,
};

export function tenantFor(org: string): Tenant {
  return TENANTS[org] ?? openedxTenant;
}

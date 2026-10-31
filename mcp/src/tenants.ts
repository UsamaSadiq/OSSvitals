import index from "../../dashboard/config/tenants.json";

export type TenantKind = "health" | "fleet";

export interface Tenant {
  readonly kind: TenantKind;
  readonly site: string;
}

const TENANTS = index as Readonly<Record<string, Tenant>>;

export function tenantFor(org: string): Tenant | undefined {
  return Object.hasOwn(TENANTS, org) ? TENANTS[org] : undefined;
}

export function tenantOrgs(): string[] {
  return Object.keys(TENANTS);
}

import index from "../../dashboard/config/tenants.json";

export type TenantKind = "health" | "fleet";

export interface Tenant {
  readonly kind: TenantKind;
  readonly site: string;
  readonly visibility?: "public" | "private";
}

const isPublic = (tenant: Tenant): boolean => (tenant.visibility ?? "public") === "public";

export function publicTenants(all: Readonly<Record<string, Tenant>>): Readonly<Record<string, Tenant>> {
  return Object.fromEntries(Object.entries(all).filter(([, tenant]) => isPublic(tenant)));
}

// The server reads only the public data host, so a private tenant is unknown here.
const TENANTS = publicTenants(index as Readonly<Record<string, Tenant>>);

export function tenantFor(org: string): Tenant | undefined {
  return Object.hasOwn(TENANTS, org) ? TENANTS[org] : undefined;
}

export function tenantOrgs(): string[] {
  return Object.keys(TENANTS);
}

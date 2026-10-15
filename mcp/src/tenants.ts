export type TenantKind = "health" | "drift";

export interface Tenant {
  readonly kind: TenantKind;
  readonly site: string;
}

const TENANTS: Readonly<Record<string, Tenant>> = {
  openedx: { kind: "health", site: "https://openedx.ossvitals.org" },
  moneta: { kind: "drift", site: "https://moneta.ossvitals.org" },
};

export function tenantFor(org: string): Tenant | undefined {
  return Object.hasOwn(TENANTS, org) ? TENANTS[org] : undefined;
}

export function tenantOrgs(): string[] {
  return Object.keys(TENANTS);
}

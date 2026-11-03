import index from "../../dashboard/config/tenants.json";

export interface PrivateTenant {
  readonly org: string;
  readonly emailDomains: readonly string[];
}

interface IndexEntry {
  readonly site: string;
  readonly visibility?: string;
  readonly access?: { readonly email_domains: readonly string[] };
}

export type TenantsByHost = ReadonlyMap<string, PrivateTenant>;

export function privateTenantsByHost(entries: Readonly<Record<string, IndexEntry>>): TenantsByHost {
  return new Map(
    Object.entries(entries)
      .filter(([, tenant]) => tenant.visibility === "private" && tenant.access)
      .map(([org, tenant]) => [new URL(tenant.site).hostname, { org, emailDomains: tenant.access?.email_domains ?? [] }]),
  );
}

export const TENANTS: TenantsByHost = privateTenantsByHost(index as Readonly<Record<string, IndexEntry>>);

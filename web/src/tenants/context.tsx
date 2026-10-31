import { createContext, useContext, type ReactNode } from "react";
import { currentOrg } from "../data/org";
import type { Tenant } from "./types";

const TenantContext = createContext<Tenant | null>(null);

export function TenantProvider({ tenant, children }: { tenant: Tenant; children: ReactNode }) {
  return <TenantContext value={tenant}>{children}</TenantContext>;
}

/** The org whose data a page reads: the tenant's, or the host's outside a tenant (the site metadata loads before it). */
export function useTenantOrg(): string {
  return useContext(TenantContext)?.org ?? currentOrg();
}

export function useTenant(): Tenant {
  const tenant = useContext(TenantContext);
  if (!tenant) throw new Error("useTenant must be used inside a TenantProvider");
  return tenant;
}

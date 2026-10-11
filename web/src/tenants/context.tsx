import { createContext, useContext, type ReactNode } from "react";
import type { Tenant } from "./types";

const TenantContext = createContext<Tenant | null>(null);

export function TenantProvider({ tenant, children }: { tenant: Tenant; children: ReactNode }) {
  return <TenantContext value={tenant}>{children}</TenantContext>;
}

export function useTenant(): Tenant {
  const tenant = useContext(TenantContext);
  if (!tenant) throw new Error("useTenant must be used inside a TenantProvider");
  return tenant;
}

import { useMemo, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { toSiteMeta } from "./data/siteMeta";
import { currentOrg } from "./data/org";
import { useView, type ViewState } from "./data/useView";
import { DEFAULT_SITE_META, SiteMetaProvider, type SiteMeta } from "./layout/siteMeta";
import { TenantProvider } from "./tenants/context";
import { tenantFor } from "./tenants/registry";

const tenant = tenantFor(currentOrg());
const router = createBrowserRouter(tenant.routes);

function siteMetaFor(meta: ViewState<"meta">): SiteMeta {
  if (meta.status === "ready") return toSiteMeta(meta.data);
  if (meta.status === "error") return { ...DEFAULT_SITE_META, loadError: meta.error.message };
  return DEFAULT_SITE_META;
}

function useLoadedSiteMeta(): SiteMeta {
  const meta = useView("meta");
  return useMemo(() => siteMetaFor(meta), [meta]);
}

function LoadedSiteMeta({ children }: { children: ReactNode }) {
  return <SiteMetaProvider value={useLoadedSiteMeta()}>{children}</SiteMetaProvider>;
}

export function App() {
  return (
    <TenantProvider tenant={tenant}>
      <LoadedSiteMeta>
        <RouterProvider router={router} />
      </LoadedSiteMeta>
    </TenantProvider>
  );
}

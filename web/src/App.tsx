import { useMemo, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
import { toSiteMeta } from "./data/siteMeta";
import { currentOrg } from "./data/org";
import { useView, type ViewState } from "./data/useView";
import { DEFAULT_SITE_META, SiteMetaProvider, type SiteMeta } from "./layout/siteMeta";
import { RouteError } from "./layout/RouteError";
import { TenantProvider } from "./tenants/context";
import { tenantFor } from "./tenants/registry";

const tenant = tenantFor(currentOrg());
/** An error in a page renders inside the shell, so the header and navigation stay; the root one covers the shell itself. */
function withErrorPages(route: RouteObject): RouteObject {
  const pages = route.children ? { children: [{ errorElement: <RouteError />, children: route.children }] } : {};
  return { errorElement: <RouteError />, ...route, ...pages } as RouteObject;
}

const router = createBrowserRouter(tenant.routes.map(withErrorPages));

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

import { useMemo, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { toSiteMeta } from "./data/siteMeta";
import { useView, type ViewState } from "./data/useView";
import { DEFAULT_SITE_META, SiteMetaProvider, type SiteMeta } from "./layout/siteMeta";
import { routes } from "./routes";

const router = createBrowserRouter(routes);

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
    <LoadedSiteMeta>
      <RouterProvider router={router} />
    </LoadedSiteMeta>
  );
}

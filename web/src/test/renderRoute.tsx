import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { DEFAULT_SITE_META, SiteMetaProvider, type SiteMeta } from "../layout/siteMeta";
import { routes } from "../routes";

export function renderRoute(path: string, meta: SiteMeta = DEFAULT_SITE_META) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <SiteMetaProvider value={meta}>
      <RouterProvider router={router} />
    </SiteMetaProvider>,
  );
}

export function withMaintainerViews(enabled: boolean, meta: SiteMeta = DEFAULT_SITE_META): SiteMeta {
  return { ...meta, featureFlags: { ...meta.featureFlags, enableMaintainerViews: enabled } };
}

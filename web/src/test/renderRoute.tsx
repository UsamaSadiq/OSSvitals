import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { metaFixture } from "../data/fixtures";
import { toSiteMeta } from "../data/siteMeta";
import { DEFAULT_SITE_META, SiteMetaProvider, type SiteMeta } from "../layout/siteMeta";
import { TenantProvider } from "../tenants/context";
import { openedxTenant } from "../tenants/openedx";
import type { Tenant } from "../tenants/types";

const { name, shortName, tagline, title, githubOrg, unmaintainedGroup, scoresFileUrl, provenance, catalog, footer } =
  toSiteMeta(metaFixture());

export const OPENEDX_SITE_META: SiteMeta = {
  ...DEFAULT_SITE_META,
  name,
  shortName,
  tagline,
  title,
  githubOrg,
  unmaintainedGroup,
  scoresFileUrl,
  provenance,
  catalog,
  footer,
};

export function renderRoute(path: string, meta: SiteMeta = OPENEDX_SITE_META, tenant: Tenant = openedxTenant) {
  const router = createMemoryRouter(tenant.routes, { initialEntries: [path] });
  const rendered = render(
    <TenantProvider tenant={tenant}>
      <SiteMetaProvider value={meta}>
        <RouterProvider router={router} />
      </SiteMetaProvider>
    </TenantProvider>,
  );
  return { ...rendered, router };
}

export function withMaintainerViews(enabled: boolean, meta: SiteMeta = OPENEDX_SITE_META): SiteMeta {
  return { ...meta, featureFlags: { ...meta.featureFlags, enableMaintainerViews: enabled } };
}

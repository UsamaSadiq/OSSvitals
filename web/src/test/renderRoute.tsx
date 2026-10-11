import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { metaFixture } from "../data/fixtures";
import { toSiteMeta } from "../data/siteMeta";
import { DEFAULT_SITE_META, SiteMetaProvider, type SiteMeta } from "../layout/siteMeta";
import { routes } from "../routes";

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

export function renderRoute(path: string, meta: SiteMeta = OPENEDX_SITE_META) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const rendered = render(
    <SiteMetaProvider value={meta}>
      <RouterProvider router={router} />
    </SiteMetaProvider>,
  );
  return { ...rendered, router };
}

export function withMaintainerViews(enabled: boolean, meta: SiteMeta = OPENEDX_SITE_META): SiteMeta {
  return { ...meta, featureFlags: { ...meta.featureFlags, enableMaintainerViews: enabled } };
}

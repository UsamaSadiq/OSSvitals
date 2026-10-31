import type { ReactNode } from "react";
import type { RouteObject } from "react-router";
import { Shell } from "../../layout/Shell";
import { NotFound } from "../../pages/NotFound";
import { Overview } from "../../pages/Overview/Overview";
import { NAV_SECTIONS, SUB_PAGES } from "../../pages/catalog";
import { ListedPage } from "../../pages/ListedPage";
import { PageLoader, PORTED_PAGES } from "../../pages/lazyPages";
import type { PageEntry, Tenant } from "../../tenants/types";
import { HEALTH_NAV_COUNTS } from "./counts";
import { HealthPaletteHost } from "./PaletteHost";

function pageBody(page: PageEntry): ReactNode {
  const ported = PORTED_PAGES[page.path];
  return ported ? <PageLoader page={ported} /> : <NotFound />;
}

function pageElement(page: PageEntry): ReactNode {
  return <ListedPage page={page}>{pageBody(page)}</ListedPage>;
}

const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      { index: true, element: <Overview /> },
      ...SUB_PAGES.map((page) => ({ path: page.path, element: pageElement(page) })),
      { path: "*", element: <NotFound /> },
    ],
  },
];

export function healthTenant(org: string): Tenant {
  return {
    org,
    sections: NAV_SECTIONS,
    routes,
    navCounts: HEALTH_NAV_COUNTS,
    PaletteHost: HealthPaletteHost,
    paletteCopy: {
      placeholder: "Search repositories, checks, owners, pages…",
      ariaLabel: "Search pages, repositories, checks and owners",
      loadingNote: "Loading repositories, checks and owners…",
    },
  };
}

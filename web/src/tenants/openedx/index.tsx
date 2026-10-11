import type { ReactNode } from "react";
import type { RouteObject } from "react-router";
import { Shell } from "../../layout/Shell";
import { MaintainerOnly } from "../../pages/MaintainerOnly";
import { NotFound } from "../../pages/NotFound";
import { Overview } from "../../pages/Overview/Overview";
import { NAV_SECTIONS, SUB_PAGES } from "../../pages/catalog";
import { PageLoader, PORTED_PAGES } from "../../pages/lazyPages";
import type { PageEntry, Tenant } from "../types";
import { OPENEDX_NAV_COUNTS } from "./counts";
import { OpenedxPaletteHost } from "./PaletteHost";

function pageBody(page: PageEntry): ReactNode {
  const ported = PORTED_PAGES[page.path];
  return ported ? <PageLoader page={ported} /> : <NotFound />;
}

function pageElement(page: PageEntry): ReactNode {
  const body = pageBody(page);
  return page.maintainerOnly ? <MaintainerOnly>{body}</MaintainerOnly> : body;
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

export const openedxTenant: Tenant = {
  org: "openedx",
  sections: NAV_SECTIONS,
  routes,
  navCounts: OPENEDX_NAV_COUNTS,
  PaletteHost: OpenedxPaletteHost,
  paletteCopy: {
    placeholder: "Search repositories, checks, owners, pages…",
    ariaLabel: "Search pages, repositories, checks and owners",
    loadingNote: "Loading repositories, checks and owners…",
  },
};

import type { ReactNode } from "react";
import type { RouteObject } from "react-router";
import { Shell } from "./layout/Shell";
import { NotFound } from "./pages/NotFound";
import { Overview } from "./pages/Overview/Overview";
import { MaintainerOnly } from "./pages/MaintainerOnly";
import { PageLoader, PORTED_PAGES } from "./pages/lazyPages";
import { SUB_PAGES, type PageEntry } from "./pages/catalog";

function pageBody(page: PageEntry): ReactNode {
  const ported = PORTED_PAGES[page.path];
  return ported ? <PageLoader page={ported} /> : <NotFound />;
}

function pageElement(page: PageEntry): ReactNode {
  const body = pageBody(page);
  return page.maintainerOnly ? <MaintainerOnly>{body}</MaintainerOnly> : body;
}

const pageRoutes: RouteObject[] = SUB_PAGES.map((page) => ({
  path: page.path,
  element: pageElement(page),
}));

export const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      { index: true, element: <Overview /> },
      ...pageRoutes,
      { path: "*", element: <NotFound /> },
    ],
  },
];

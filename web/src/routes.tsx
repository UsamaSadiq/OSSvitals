import type { RouteObject } from "react-router";
import { Shell } from "./layout/Shell";
import { NotFound } from "./pages/NotFound";
import { Overview } from "./pages/Overview/Overview";
import { MaintainerOnly } from "./pages/MaintainerOnly";
import { Placeholder } from "./pages/Placeholder";
import { PLACEHOLDER_PAGES, type PageEntry } from "./pages/catalog";

function placeholderElement(page: PageEntry) {
  const placeholder = <Placeholder title={page.title} />;
  return page.maintainerOnly ? <MaintainerOnly>{placeholder}</MaintainerOnly> : placeholder;
}

const placeholderRoutes: RouteObject[] = PLACEHOLDER_PAGES.map((page) => ({
  path: page.path,
  element: placeholderElement(page),
}));

export const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      { index: true, element: <Overview /> },
      ...placeholderRoutes,
      { path: "*", element: <NotFound /> },
    ],
  },
];

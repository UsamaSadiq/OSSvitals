import type { RouteObject } from "react-router";
import { Shell } from "../../layout/Shell";
import { useSiteMeta } from "../../layout/siteMeta";
import { NotFound } from "../../pages/NotFound";
import { pageItems } from "../../search/paletteItems";
import type { PaletteHostProps, Tenant } from "../types";

function MonetaOverview() {
  const { name, tagline } = useSiteMeta();
  return (
    <>
      <h1>{name}</h1>
      <p>{tagline}</p>
    </>
  );
}

function MonetaPaletteHost({ pages, children }: PaletteHostProps) {
  return <>{children({ items: { pages: pageItems(pages) }, loading: false, unavailable: [] })}</>;
}

const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      { index: true, element: <MonetaOverview /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const monetaTenant: Tenant = {
  org: "moneta",
  sections: [{ title: "Status", pages: [{ path: "/", title: "Overview" }] }],
  routes,
  navCounts: {},
  PaletteHost: MonetaPaletteHost,
  paletteCopy: {
    placeholder: "Search pages…",
    ariaLabel: "Search pages",
    loadingNote: "Loading…",
  },
};

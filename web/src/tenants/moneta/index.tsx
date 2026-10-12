import type { RouteObject } from "react-router";
import { Shell } from "../../layout/Shell";
import { NotFound } from "../../pages/NotFound";
import type { Tenant } from "../types";
import { AppDetail } from "./AppDetail";
import { MonetaApps } from "./Apps";
import { MonetaAttention } from "./AttentionPage";
import { MonetaOverview } from "./Overview";
import { MonetaPaletteHost } from "./PaletteHost";

const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      { index: true, element: <MonetaOverview /> },
      { path: "apps", element: <MonetaApps /> },
      { path: "attention", element: <MonetaAttention /> },
      { path: "apps/:repo", element: <AppDetail /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const monetaTenant: Tenant = {
  org: "moneta",
  sections: [
    {
      title: "Status",
      pages: [
        { path: "/", title: "Overview" },
        { path: "/apps", title: "Apps" },
        { path: "/attention", title: "Needs attention" },
      ],
    },
  ],
  routes,
  navCounts: {},
  PaletteHost: MonetaPaletteHost,
  paletteCopy: {
    placeholder: "Search apps and pages…",
    ariaLabel: "Search apps and pages",
    loadingNote: "Loading…",
  },
};

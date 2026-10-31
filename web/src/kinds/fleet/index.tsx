import type { RouteObject } from "react-router";
import { Shell } from "../../layout/Shell";
import { NotFound } from "../../pages/NotFound";
import type { Tenant } from "../../tenants/types";
import { AppDetail } from "./AppDetail";
import { FleetApps } from "./Apps";
import { FleetAttention } from "./AttentionPage";
import { FleetOverview } from "./Overview";
import { FleetPaletteHost } from "./PaletteHost";
import { SignalVisibilityProvider } from "./visibility";

const routes: RouteObject[] = [
  {
    element: (
      <SignalVisibilityProvider>
        <Shell />
      </SignalVisibilityProvider>
    ),
    children: [
      { index: true, element: <FleetOverview /> },
      { path: "apps", element: <FleetApps /> },
      { path: "attention", element: <FleetAttention /> },
      { path: "apps/:repo", element: <AppDetail /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export function fleetTenant(org: string): Tenant {
  return {
    org,
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
    PaletteHost: FleetPaletteHost,
    paletteCopy: {
      placeholder: "Search apps and pages…",
      ariaLabel: "Search apps and pages",
      loadingNote: "Loading…",
    },
  };
}

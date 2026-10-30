import type { NavSection, PageEntry } from "../tenants/types";

export type { NavSection, PageEntry };

export const OVERVIEW: PageEntry = { path: "/", title: "Overview" };

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Health",
    pages: [
      OVERVIEW,
      { path: "/repos", title: "Repositories" },
      { path: "/repo_detail", title: "Repo Detail" },
      { path: "/failing_checks", title: "Failing Checks" },
      { path: "/what_changed", title: "What Changed" },
    ],
  },
  {
    title: "Maintenance",
    pages: [
      { path: "/needing_attention", title: "Needing Attention" },
      { path: "/at_risk", title: "At Risk", maintainerOnly: true },
      { path: "/ownership_views", title: "Owners", maintainerOnly: true },
      { path: "/maintenance", title: "Upgrades" },
      { path: "/support_window", title: "Support Window" },
    ],
  },
  {
    title: "Reference",
    pages: [
      { path: "/components", title: "Components" },
      { path: "/glossary", title: "Checks Catalog" },
      { path: "/scoring", title: "How Scoring Works" },
    ],
  },
];

export const ALL_PAGES: PageEntry[] = NAV_SECTIONS.flatMap((section) => section.pages);

export const SUB_PAGES: PageEntry[] = ALL_PAGES.filter((page) => page !== OVERVIEW);

export interface PageVisibility {
  maintainerViews: boolean;
  manifest?: readonly string[];
}

export function isPageVisible(page: PageEntry, { maintainerViews, manifest }: PageVisibility): boolean {
  if (page.maintainerOnly && !maintainerViews) return false;
  return manifest === undefined || manifest.includes(page.path);
}

export function visibleSections(sections: readonly NavSection[], visibility: PageVisibility): NavSection[] {
  return sections
    .map((section) => ({ ...section, pages: section.pages.filter((page) => isPageVisible(page, visibility)) }))
    .filter((section) => section.pages.length > 0);
}

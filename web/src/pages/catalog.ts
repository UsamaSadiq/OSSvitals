export interface PageEntry {
  path: string;
  title: string;
  maintainerOnly?: boolean;
}

export interface NavSection {
  title: string;
  pages: PageEntry[];
}

export const OVERVIEW: PageEntry = { path: "/", title: "Overview" };

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Health",
    pages: [
      OVERVIEW,
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

export function visibleSections(sections: NavSection[], maintainerViews: boolean): NavSection[] {
  return sections.map((section) => ({
    ...section,
    pages: section.pages.filter((page) => maintainerViews || !page.maintainerOnly),
  }));
}

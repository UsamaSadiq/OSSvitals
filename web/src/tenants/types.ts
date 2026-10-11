import type { ComponentType, ReactNode } from "react";
import type { RouteObject } from "react-router";
import type { PaletteIndex } from "../search/usePaletteIndex";

export interface PageEntry {
  path: string;
  title: string;
  maintainerOnly?: boolean;
}

export interface NavSection {
  title: string;
  pages: PageEntry[];
}

export interface PaletteHostProps {
  pages: readonly PageEntry[];
  maintainerViews: boolean;
  children: (index: PaletteIndex) => ReactNode;
}

export interface PaletteCopy {
  placeholder: string;
  ariaLabel: string;
  loadingNote: string;
}

export interface Tenant {
  org: string;
  sections: NavSection[];
  routes: RouteObject[];
  navCounts: Record<string, ComponentType>;
  PaletteHost: ComponentType<PaletteHostProps>;
  paletteCopy: PaletteCopy;
}

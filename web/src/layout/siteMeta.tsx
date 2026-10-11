import { createContext, useContext, type ReactNode } from "react";
import type { FreshnessBannerProps } from "./FreshnessBanner";

export interface FooterMeta {
  sourceUrl?: string;
  privacyUrl?: string;
  notice?: string;
}

export interface ProvenanceMeta {
  checksName?: string;
  checksRepoLabel?: string;
  checksRepoUrl?: string;
  dataRepoLabel?: string;
  dataRepoUrl?: string;
  governanceBody?: string;
}

export interface CatalogMeta {
  name?: string;
  browseUrl?: string;
  membershipScope?: string;
  specName?: string;
  specUrl?: string;
}

export interface SiteMeta {
  name: string;
  shortName: string;
  tagline: string;
  title: string;
  pages?: readonly string[];
  githubOrg?: string;
  unmaintainedGroup?: string;
  scoresFileUrl?: string;
  provenance: ProvenanceMeta;
  catalog: CatalogMeta;
  footer: FooterMeta;
  featureFlags: {
    enableMaintainerViews: boolean;
    enableWeeklyBulletinExport: boolean;
    enableMyReposFilter: boolean;
    enablePrTemplateGenerator: boolean;
  };
  freshness?: FreshnessBannerProps;
  snapshotDate?: string;
  loadError?: string;
}

export const DEFAULT_SITE_META: SiteMeta = {
  name: "Repository Health Dashboard",
  shortName: "Repository Health",
  tagline: "Health insights for open-source repositories",
  title: "Repo Health",
  provenance: {},
  catalog: {},
  footer: {
    sourceUrl: "https://github.com/UsamaSadiq/OSSvitals",
    privacyUrl: "https://github.com/UsamaSadiq/OSSvitals/blob/main/docs/PRIVACY.md",
  },
  featureFlags: {
    enableMaintainerViews: true,
    enableWeeklyBulletinExport: true,
    enableMyReposFilter: true,
    enablePrTemplateGenerator: true,
  },
};

const SiteMetaContext = createContext<SiteMeta>(DEFAULT_SITE_META);

export function SiteMetaProvider({ value, children }: { value: SiteMeta; children: ReactNode }) {
  return <SiteMetaContext value={value}>{children}</SiteMetaContext>;
}

export function useSiteMeta(): SiteMeta {
  return useContext(SiteMetaContext);
}

export function useCatalogName(): string {
  return useSiteMeta().catalog.name ?? "Catalog";
}

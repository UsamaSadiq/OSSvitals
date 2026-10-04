import { createContext, useContext, type ReactNode } from "react";
import type { FreshnessBannerProps } from "./FreshnessBanner";

export interface FooterMeta {
  sourceUrl?: string;
  privacyUrl?: string;
  notice?: string;
}

export interface SiteMeta {
  name: string;
  shortName: string;
  tagline: string;
  footer: FooterMeta;
  featureFlags: {
    enableMaintainerViews: boolean;
    enableWeeklyBulletinExport: boolean;
    enableMyReposFilter: boolean;
    enablePrTemplateGenerator: boolean;
  };
  freshness?: FreshnessBannerProps;
  loadError?: string;
}

export const DEFAULT_SITE_META: SiteMeta = {
  name: "Open edX Repository Health Dashboard",
  shortName: "Open edX Health",
  tagline: "Visualization-first health insights for Open edX repositories",
  footer: {
    sourceUrl: "https://github.com/UsamaSadiq/OSSvitals",
    privacyUrl: "https://github.com/UsamaSadiq/OSSvitals/blob/main/docs/PRIVACY.md",
    notice:
      "Unofficial community project, not affiliated with Axim Collaborative. Open edX is a registered trademark of Axim Collaborative.",
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

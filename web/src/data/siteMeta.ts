import type { SiteMeta } from "../layout/siteMeta";
import { freshnessOf } from "./freshness";
import type { MetaView } from "./schemas";

export function toSiteMeta(meta: MetaView, now: Date = new Date()): SiteMeta {
  const { branding, feature_flags: flags } = meta;
  const footer = branding.footer ?? {};
  return {
    name: branding.name,
    shortName: branding.short_name,
    tagline: branding.tagline,
    footer: {
      sourceUrl: footer.source_url,
      privacyUrl: footer.privacy_url,
      notice: footer.notice,
    },
    featureFlags: {
      enableMaintainerViews: flags.enable_maintainer_views,
      enableWeeklyBulletinExport: flags.enable_weekly_bulletin_export ?? true,
      enableMyReposFilter: flags.enable_my_repos_filter ?? true,
      enablePrTemplateGenerator: flags.enable_pr_template_generator ?? true,
    },
    freshness: freshnessOf(meta, now),
  };
}

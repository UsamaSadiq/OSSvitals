import type { SiteMeta } from "../layout/siteMeta";
import { freshnessOf } from "./freshness";
import { snapshotDateOf } from "./snapshotDate";
import type { MetaView } from "./schemas";

function scoresFileUrl(sourceUrl: string | undefined, org: string | undefined): string | undefined {
  if (!sourceUrl || !org) return undefined;
  return `${sourceUrl.replace(/\/$/, "")}/blob/data/${org}/scores.json`;
}

export function toSiteMeta(meta: MetaView, now: Date = new Date()): SiteMeta {
  const { branding, feature_flags: flags } = meta;
  const footer = branding.footer ?? {};
  const provenance = branding.provenance ?? {};
  const catalog = branding.catalog ?? {};
  return {
    name: branding.name,
    shortName: branding.short_name,
    tagline: branding.tagline,
    title: branding.site_title ?? branding.short_name,
    pages: meta.pages,
    githubOrg: meta.github_org,
    unmaintainedGroup: meta.unmaintained_group ?? undefined,
    scoresFileUrl: scoresFileUrl(footer.source_url, meta.metadata.org),
    provenance: {
      checksName: provenance.checks_name,
      checksRepoLabel: provenance.checks_repo_label,
      checksRepoUrl: provenance.checks_repo_url,
      dataRepoLabel: provenance.data_repo_label,
      dataRepoUrl: provenance.data_repo_url,
      governanceBody: provenance.governance_body,
    },
    catalog: {
      name: catalog.name,
      browseUrl: catalog.browse_url,
      membershipScope: catalog.membership_scope,
      specName: catalog.spec_name,
      specUrl: catalog.spec_url,
    },
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
    snapshotDate: snapshotDateOf(meta.metadata.snapshot_timestamp) ?? undefined,
  };
}

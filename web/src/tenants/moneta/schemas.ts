import { z } from "zod";

const nullableString = z.string().nullable();
const optionalString = z.string().nullish();

const release = z.object({ tag: z.string(), date: nullableString });

const appRecord = z.object({
  repo: z.string(),
  class: z.enum(["fork", "original"]),
  url: z.string(),
  description: nullableString,
  licence: nullableString,
  licence_note: optionalString,
  upstream: nullableString,
  upstream_url: nullableString,
  upstream_branch: nullableString,
  production_branch: nullableString,
  purpose: nullableString,
  what_we_changed: nullableString,
  mcp_server: optionalString,
  sso: optionalString,
  e2e: optionalString,
  runbook_url: optionalString,
  pushed_at: z.string(),
  open_pull_requests: z.number().int().nullish(),
  latest_tag: nullableString,
});

const advisoryItem = z.object({
  ghsa_id: nullableString,
  severity: nullableString,
  summary: nullableString,
  url: nullableString,
  published_at: z.string(),
  after_our_release: z.boolean(),
});

const driftRecord = z.object({
  repo: z.string(),
  status: z.string(),
  ahead_by: z.number().int(),
  behind_by: z.number().int(),
  last_upstream_merge: z.string(),
  days_since_upstream_merge: z.number().int(),
  fork_release: release.nullable(),
  release_candidate: z.object({ tag: z.string() }).nullish(),
  upstream_release: release.nullable(),
  release_lag: z
    .object({ upstream_releases_since_sync: z.number().int(), upstream_ahead_of_our_release_days: z.number().int().nullable() })
    .nullish(),
  advisories: z.object({
    published: z.number().int(),
    since_fork_release: z.number().int(),
    severe_since_fork_release: z.number().int().optional(),
    source: z.string(),
    items: z.array(advisoryItem).optional(),
  }),
  promotion: z.object({ unpromoted_commits: z.number().int() }).nullable(),
  ci: z.object({ state: z.enum(["passing", "failing", "pending", "none"]), total: z.number().int() }).nullish(),
  pull_requests: z
    .object({ open: z.number().int(), sync_pull: z.object({ number: z.number().int(), title: z.string(), url: z.string() }).nullable() })
    .nullish(),
  maintainers: z.array(z.object({ login: z.string(), merged: z.number().int() })).nullish(),
  upstream_activity: z.object({ pushed_at: z.string(), idle_days: z.number().int(), quiet: z.boolean() }).nullish(),
});

const historyRow = z.object({
  date: z.string(),
  repo: z.string(),
  status: z.string(),
  behind_by: z.number().int(),
  ahead_by: z.number().int(),
  advisories_since_release: z.number().int(),
});

const update = z.object({ date: z.string(), title: z.string(), url: optionalString, repo: optionalString });

const forecast = z.object({ clean: z.boolean(), conflicted_files: z.array(z.string()), conflicted_total: z.number().int() });

const conflictRecord = z.object({
  repo: z.string(),
  error: z.string().optional(),
  against_upstream_head: forecast.optional(),
  against_upstream_release: forecast.extend({ tag: z.string() }).nullish(),
});

const envelope = z.looseObject({ generated_at: z.string(), org: z.string() });

function view<Shape extends z.ZodTypeAny>(record: Shape) {
  return z.object({ metadata: envelope, records: z.array(record) });
}

export const appsSchema = view(appRecord);
export const driftSchema = view(driftRecord);
export const historySchema = view(historyRow);
export const updatesSchema = view(update);
export const conflictsSchema = view(conflictRecord);

export type AppRecord = z.infer<typeof appRecord>;
export type DriftRecord = z.infer<typeof driftRecord>;
export type AdvisoryItem = z.infer<typeof advisoryItem>;
export type HistoryRow = z.infer<typeof historyRow>;
export type UpdateRecord = z.infer<typeof update>;
export type ConflictRecord = z.infer<typeof conflictRecord>;
export type AppsView = z.infer<typeof appsSchema>;
export type DriftView = z.infer<typeof driftSchema>;
export type HistoryView = z.infer<typeof historySchema>;
export type UpdatesView = z.infer<typeof updatesSchema>;
export type ConflictsView = z.infer<typeof conflictsSchema>;

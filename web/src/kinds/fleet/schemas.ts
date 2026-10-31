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
  affects_fork_release: z.boolean().nullish(),
});

const releaseGap = z.object({
  base: z.string(),
  base_ref: nullableString,
  latest: z.string(),
  releases_behind: z.number().int(),
  level: z.enum(["none", "patch", "minor", "major"]),
  days_behind: z.number().int(),
});

const driftRecord = z.object({
  repo: z.string(),
  status: z.string(),
  status_basis: z.enum(["release", "commits"]).nullish(),
  ahead_by: z.number().int(),
  behind_by: z.number().int(),
  behind_release: z.number().int().nullish(),
  ahead_release: z.number().int().nullish(),
  last_upstream_merge: z.string(),
  days_since_upstream_merge: z.number().int(),
  fork_release: release.nullish(),
  release_candidate: z.object({ tag: z.string() }).nullish(),
  upstream_release: release.nullish(),
  release_lag: z
    .object({ upstream_releases_since_sync: z.number().int(), upstream_ahead_of_our_release_days: z.number().int().nullable() })
    .nullish(),
  release_gap: releaseGap.nullish(),
  advisories: z.object({
    published: z.number().int(),
    since_fork_release: z.number().int(),
    severe_since_fork_release: z.number().int().optional(),
    since_our_code: z.number().int().optional(),
    severe_since_our_code: z.number().int().optional(),
    affecting_fork_release: z.number().int().optional(),
    severe_affecting_fork_release: z.number().int().optional(),
    base_release: z.string().nullish(),
    source: z.string(),
    items: z.array(advisoryItem).optional(),
  }).nullish(),
  promotion: z.object({ unpromoted_commits: z.number().int() }).nullish(),
  ci: z.object({ state: z.enum(["passing", "failing", "pending", "none"]), total: z.number().int() }).nullish(),
  pull_requests: z
    .object({ open: z.number().int(), sync_pull: z.object({ number: z.number().int(), title: z.string(), url: z.string() }).nullable() })
    .nullish(),
  maintainers: z.array(z.object({ login: z.string(), merged: z.number().int() })).nullish(),
  upstream_activity: z.object({ pushed_at: z.string(), idle_days: z.number().int(), quiet: z.boolean() }).nullish(),
  licence_watch: z
    .object({
      present: z.boolean(),
      path: nullableString,
      sha: nullableString,
      spdx: nullableString,
      declared: nullableString,
      matches_declared: z.boolean().nullable(),
      changed_on: nullableString,
      previous_spdx: nullableString,
      previous_present: z.boolean().nullish(),
    })
    .nullish(),
  upstream_health: z
    .object({
      contributors: z
        .object({
          commits: z.number().int(),
          automated_commits: z.number().int().nullish(),
          people: z.number().int(),
          half_of_commits_by: z.number().int().nullable(),
          top_share: z.number().nullable(),
          truncated: z.boolean().nullish(),
          as_of: nullableString.optional(),
        })
        .nullable(),
      releases: z.object({ last_year: z.number().int(), days_since_latest: z.number().int().nullable(), median_gap_days: z.number().int().nullable() }),
      default_branch: nullableString.optional(),
      tracks_default_branch: z.boolean().nullish(),
    })
    .nullish(),
  exploitability: z
    .object({
      basis: z.enum(["release", "commits"]),
      considered: z.number().int(),
      undetermined: z.number().int().nullish(),
      without_cve: z.number().int(),
      known_exploited: z.array(
        z.object({ ghsa_id: nullableString, cve_id: z.string(), severity: nullableString, date_added: nullableString, certain: z.boolean().nullish() }),
      ),
      kev_as_of: z.string(),
      kev_from_cache: z.boolean(),
      epss: z
        .object({
          as_of: nullableString,
          from_previous: z.boolean(),
          min: z.number(),
          likely: z.number().int(),
          likely_uncertain: z.number().int().nullish(),
          top: z.array(
            z.object({
              ghsa_id: nullableString,
              cve_id: z.string(),
              severity: nullableString,
              epss: z.number(),
              percentile: z.number(),
              certain: z.boolean().nullish(),
            }),
          ),
        })
        .nullish(),
    })
    .nullish(),
});

const historyRow = z.object({
  date: z.string(),
  repo: z.string(),
  status: z.string(),
  behind_by: z.number().int(),
  ahead_by: z.number().int(),
  advisories_since_release: z.number().int().optional(),
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
const failedRecord = z.object({ repo: z.string(), error: z.string() });

function isFailed(record: unknown): boolean {
  return failedRecord.safeParse(record).success;
}

function splitFailed({ metadata, records }: { metadata: z.infer<typeof envelope>; records: unknown[] }) {
  return { metadata, records: records.filter((record) => !isFailed(record)), failed: records.filter(isFailed) };
}

export const driftSchema = z
  .object({ metadata: envelope, records: z.array(z.unknown()) })
  .transform(splitFailed)
  .pipe(z.object({ metadata: envelope, records: z.array(driftRecord), failed: z.array(failedRecord) }));
export const historySchema = view(historyRow);
export const updatesSchema = view(update);
export const conflictsSchema = view(conflictRecord);
const patchItem = z.object({ sha: z.string(), date: nullableString, subject: z.string() });
const carriedRecord = z.object({
  repo: z.string(),
  error: z.string().optional(),
  compared: z.boolean().optional(),
  commits: z.number().int().optional(),
  carried: z.number().int().nullish(),
  already_upstream: z.number().int().nullish(),
  carried_items: z.array(patchItem).optional(),
  already_upstream_items: z.array(patchItem).optional(),
});
export const carriedSchema = view(carriedRecord);
const flaggedRelease = z.object({ tag: z.string(), url: nullableString, published_at: nullableString, lines: z.array(z.string()) });
const upgradeRecord = z.object({
  repo: z.string(),
  error: z.string().optional(),
  migrations: z
    .object({
      ours: z.number().int(),
      upstream: z.number().int(),
      shared_dirs: z.array(z.string()),
      sequential_dirs: z.array(z.string()).default([]),
      same_prefix: z.array(z.object({ dir: z.string(), prefix: z.string(), ours: z.array(z.string()), upstream: z.array(z.string()) })),
    })
    .nullish(),
  release_notes: z
    .object({ basis: z.enum(["release", "commits"]), since: nullableString, releases: z.number().int(), flagged: z.array(flaggedRelease) })
    .nullish(),
});
export const upgradeSchema = view(upgradeRecord);

const manifestSignal = z.object({
  collect: z.boolean(),
  show: z.array(z.string()),
  tier: z.string().default("api"),
  cadence: z.string().default("daily"),
  thresholds: z.array(z.string()).default([]),
  settings: z.record(z.string(), z.unknown()).default({}),
});
const manifestStatus = z.looseObject({ key: z.string(), label: z.string(), color: z.string().optional() });

export const fleetMetaSchema = z.looseObject({
  kind: z.string().optional(),
  fleet: z.object({ signals: z.record(z.string(), manifestSignal), statuses: z.array(manifestStatus) }).optional(),
});

export interface ViewSpec<T, Required extends boolean = boolean> {
  file: string;
  schema: z.ZodType<T>;
  required: Required;
}

function spec<T, Required extends boolean>(file: string, schema: z.ZodType<T>, required: Required): ViewSpec<T, Required> {
  return { file, schema, required };
}

/** Every view a fleet tenant publishes: the pages load these and the data sync checks them before upload. */
export const FLEET_VIEWS = {
  apps: spec("apps.json", appsSchema, true),
  drift: spec("drift.json", driftSchema, true),
  history: spec("drift_history.json", historySchema, false),
  updates: spec("updates.json", updatesSchema, false),
  conflicts: spec("conflicts.json", conflictsSchema, false),
  meta: spec("meta.json", fleetMetaSchema, false),
  carried: spec("carried_patches.json", carriedSchema, false),
  upgrade: spec("upgrade_risk.json", upgradeSchema, false),
};

export type AppRecord = z.infer<typeof appRecord>;
export type DriftRecord = z.infer<typeof driftRecord>;
export type ReleaseGap = z.infer<typeof releaseGap>;
export type AdvisoryItem = z.infer<typeof advisoryItem>;
export type HistoryRow = z.infer<typeof historyRow>;
export type UpdateRecord = z.infer<typeof update>;
export type ConflictRecord = z.infer<typeof conflictRecord>;
export type FailedRecord = z.infer<typeof failedRecord>;
export type AppsView = z.infer<typeof appsSchema>;
export type DriftView = z.infer<typeof driftSchema>;
export type HistoryView = z.infer<typeof historySchema>;
export type UpdatesView = z.infer<typeof updatesSchema>;
export type ConflictsView = z.infer<typeof conflictsSchema>;
export type FleetMetaView = z.infer<typeof fleetMetaSchema>;
export type FleetManifest = NonNullable<FleetMetaView["fleet"]>;
export type ManifestSignal = z.infer<typeof manifestSignal>;
export type ManifestStatus = z.infer<typeof manifestStatus>;
export type CarriedRecord = z.infer<typeof carriedRecord>;
export type CarriedView = z.infer<typeof carriedSchema>;
export type UpgradeRecord = z.infer<typeof upgradeRecord>;
export type UpgradeView = z.infer<typeof upgradeSchema>;

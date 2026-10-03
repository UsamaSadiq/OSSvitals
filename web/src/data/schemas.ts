import { z } from "zod";

// Zod's eval feature probe trips the CSP (script-src 'self') even though it catches the error.
z.config({ jitless: true });

export const SCHEMA_VERSION = 1;

export const GRADES = ["A", "B", "C", "D", "F"] as const;

const grade = z.enum(GRADES);
const int = z.number().int();
const isoString = z.string();
const nullableNumber = z.number().nullable();

export const metadataSchema = z.looseObject({
  schema_version: int,
  org: z.string(),
  generated_at: isoString,
  snapshot_timestamp: isoString.nullable(),
  source: z.string(),
});

function view<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.object({ metadata: metadataSchema, ...shape });
}

const footerSchema = z.looseObject({
  source_url: z.string().optional(),
  privacy_url: z.string().optional(),
  notice: z.string().optional(),
});

const brandingSchema = z.looseObject({
  name: z.string(),
  short_name: z.string(),
  tagline: z.string(),
  footer: footerSchema.optional(),
});

const featureFlagsSchema = z.looseObject({
  enable_maintainer_views: z.boolean(),
  enable_weekly_bulletin_export: z.boolean().optional(),
});

export const metaSchema = view({
  config_version: z.string().nullable(),
  branding: brandingSchema,
  feature_flags: featureFlagsSchema,
  stale_threshold_hours: int,
  critically_stale_threshold_hours: int,
  snapshot_url: z.string().nullable(),
  history_url: z.string().nullable(),
});

const checkStateSchema = z.enum(["pass", "fail", "unknown"]);

const repoRecordSchema = z.looseObject({
  repo_name: z.string(),
  score_composite: z.number(),
  score_letter: grade,
  checks: z.record(z.string(), checkStateSchema),
});

export const reposSchema = view({
  records: z.array(repoRecordSchema),
});

const historyPointSchema = z.tuple([isoString, nullableNumber, grade.nullable()]);

export const historySchema = view({
  dates: z.array(isoString),
  org_average: z.array(z.tuple([isoString, z.number()])),
  repos: z.record(z.string(), z.array(historyPointSchema)),
});

const kpisSchema = z.object({
  repos: int,
  avg_composite: z.number(),
  grade_a: int,
  grade_f: int,
  stale: int,
  avg_coverage: z.number(),
  avg_measured_weight: z.number(),
});

const kpiDeltasSchema = z.object({
  repos: int,
  avg_composite: z.number(),
  grade_a: int,
  grade_f: int,
  stale: int,
});

const gradeMixSchema = z.object({ A: int, B: int, C: int, D: int, F: int });

const scoredRepoSchema = z.object({
  repo_name: z.string(),
  score_composite: z.number(),
  score_letter: grade,
});

const moverSchema = z.object({
  repo_name: z.string(),
  score_composite: z.number(),
  baseline_score: z.number(),
  delta: z.number(),
});

export const overviewSchema = view({
  kpis: kpisSchema,
  kpi_baseline: kpisSchema.nullable(),
  kpi_baseline_date: isoString.nullable(),
  avg_letter: grade,
  kpi_deltas: kpiDeltasSchema.nullable(),
  grade_mix: gradeMixSchema,
  unavailable_metrics: z.array(z.string()),
  activity_totals: z.record(z.string(), int),
  unmeasured_columns: z.array(z.string()),
  category_pass_rates: z.array(z.object({ category: z.string(), pass_rate: z.number() })),
  top_failing: z.array(z.object({ check: z.string(), failing: int })),
  highlights: z.object({
    top: z.array(scoredRepoSchema),
    bottom: z.array(scoredRepoSchema),
  }),
  gainers: z.array(moverSchema),
  losers: z.array(moverSchema),
  movers: z.array(moverSchema),
  movers_from: isoString.nullable(),
  movers_to: isoString.nullable(),
});

const repoCheckSchema = z.looseObject({ repo_name: z.string(), check: z.string() });

export const whatChangedSchema = view({
  snapshots: int,
  latest: isoString.optional(),
  previous: isoString.optional(),
  new_failures: z.array(repoCheckSchema),
  new_passes: z.array(repoCheckSchema),
  bulletin: z.string().optional(),
});

export const attentionSchema = view({
  records: z.array(
    z.looseObject({
      repo_name: z.string(),
      repo_tier: z.string(),
      score_composite: z.number(),
      score_letter: grade,
      reasons: z.string(),
    }),
  ),
});

const optionalText = z.string().nullable().optional();

export const atRiskSchema = view({
  enabled: z.boolean(),
  has_owner_data: z.boolean(),
  has_lifecycle_data: z.boolean(),
  baseline_date: isoString.nullable().optional(),
  skipped_metrics: z.array(z.string()).optional(),
  records: z.array(
    z.looseObject({
      repo_name: z.string(),
      owner_status: z.string(),
      owner: optionalText,
      lifecycle: optionalText,
      release: optionalText,
      score_composite: z.number(),
      score_letter: grade,
      score_activity: nullableNumber.optional(),
      days_since_push: nullableNumber.optional(),
      delta: nullableNumber.optional(),
      reasons: z.string(),
      catalog_link: optionalText,
      production_or_release: z.boolean(),
    }),
  ),
});

export const ownersSchema = view({
  records: z.array(
    z.looseObject({
      owner: z.string(),
      owner_key: z.string(),
      repo_count: int,
      avg_score: z.number(),
    }),
  ),
  repos: z.record(
    z.string(),
    z.array(z.looseObject({ repo_name: z.string(), score_composite: z.number(), score_letter: grade })),
  ),
});

export const checksSchema = view({
  records: z.array(
    z.looseObject({
      check: z.string(),
      category: z.string().nullable(),
      description: z.looseObject({}).nullable(),
      populated_pct: z.number(),
      pass_pct: nullableNumber,
      scored_by: z.looseObject({ metric: z.string() }).nullable(),
      has_remediation: z.boolean(),
    }),
  ),
  review_window: z.object({
    snapshots: int,
    first: isoString.nullable(),
    last: isoString.nullable(),
  }),
  up_for_review: z.array(z.looseObject({ check: z.string(), kind: z.string() })),
  candidates: z.array(z.looseObject({})),
  saturation_share: z.number().optional(),
  sparse_fill: z.number().optional(),
});

const metricRowSchema = z.looseObject({
  metric: z.string(),
  category: z.string(),
  weight_pct: z.number(),
  source: z.string(),
  rule: z.string(),
  missing_scores_as: z.number(),
  measured_pct: nullableNumber,
  defaulted_pct: nullableNumber,
  chaoss_metric: z.string(),
  provisional: z.boolean(),
  limitation: z.string(),
});

const proposedSchema = z.looseObject({
  version: z.string().nullable(),
  swaps: z.array(
    z.looseObject({
      metric: z.string(),
      replaces: z.string(),
      source: z.string(),
      rule: z.string(),
      in_snapshot: z.boolean(),
      measured_pct: nullableNumber,
    }),
  ),
  migration: z.record(z.string(), z.record(z.string(), int)),
  changes: z.array(
    z.looseObject({
      repo_name: z.string(),
      current: grade,
      proposed: grade,
      current_score: z.number(),
      proposed_score: z.number(),
      change: z.number(),
    }),
  ),
});

export const scoringSchema = view({
  version: z.string().nullable(),
  metrics: z.array(metricRowSchema),
  letter_bands: z.array(z.object({ grade, from: z.number(), to: z.number() })),
  proposed: proposedSchema.nullable(),
});

export const VIEW_SCHEMAS = {
  meta: metaSchema,
  repos: reposSchema,
  history: historySchema,
  overview: overviewSchema,
  what_changed: whatChangedSchema,
  attention: attentionSchema,
  at_risk: atRiskSchema,
  owners: ownersSchema,
  checks: checksSchema,
  scoring: scoringSchema,
} as const;

export type ViewName = keyof typeof VIEW_SCHEMAS;
export type View<Name extends ViewName> = z.infer<(typeof VIEW_SCHEMAS)[Name]>;

export const VIEW_NAMES = Object.keys(VIEW_SCHEMAS) as ViewName[];

export function viewFileName(name: ViewName): string {
  return `${name}.json`;
}

export type MetaView = View<"meta">;
export type ReposView = View<"repos">;
export type HistoryView = View<"history">;
export type OverviewView = View<"overview">;
export type WhatChangedView = View<"what_changed">;
export type AttentionView = View<"attention">;
export type AtRiskView = View<"at_risk">;
export type OwnersView = View<"owners">;
export type ChecksView = View<"checks">;
export type ScoringView = View<"scoring">;

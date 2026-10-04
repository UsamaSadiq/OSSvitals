import type { MetaView, OverviewView } from "./schemas";

export function metadata(source: string, overrides: Partial<MetaView["metadata"]> = {}): MetaView["metadata"] {
  return {
    schema_version: 1,
    org: "openedx",
    generated_at: "2026-10-02T13:29:20+00:00",
    snapshot_timestamp: "2026-10-02",
    source,
    ...overrides,
  };
}

export function metaFixture(overrides: Partial<MetaView> = {}): MetaView {
  return {
    metadata: metadata("dashboard/config"),
    config_version: "2.0",
    branding: {
      name: "Open edX Repository Health Dashboard",
      short_name: "Open edX Health",
      tagline: "Visualization-first health insights for Open edX repositories",
      colors: { primary: "#00262B" },
      footer: {
        source_url: "https://github.com/UsamaSadiq/OSSvitals",
        privacy_url: "https://github.com/UsamaSadiq/OSSvitals/blob/main/docs/PRIVACY.md",
        notice: "Unofficial community project.",
      },
    },
    feature_flags: { enable_maintainer_views: false, enable_sql_page: false },
    stale_threshold_hours: 48,
    critically_stale_threshold_hours: 168,
    snapshot_url: null,
    history_url: null,
    signals: [],
    ...overrides,
  };
}

export function overviewFixture(overrides: Partial<OverviewView> = {}): OverviewView {
  const kpis = {
    repos: 3,
    avg_composite: 70.04,
    grade_a: 1,
    grade_f: 0,
    stale: 1,
    avg_coverage: 1,
    avg_measured_weight: 0.92,
  };
  return {
    metadata: metadata("overview"),
    kpis,
    kpi_baseline: { ...kpis, avg_composite: 70.35, grade_a: 0 },
    kpi_baseline_date: "2026-09-25",
    avg_letter: "B",
    kpi_deltas: { repos: 0, avg_composite: -0.31, grade_a: 1, grade_f: 0, stale: 0 },
    grade_mix: { A: 1, B: 1, C: 1, D: 0, F: 0 },
    unavailable_metrics: [],
    activity_totals: { "github.issues_open": 3007, "github.prs_open": 1552 },
    unmeasured_columns: [],
    category_pass_rates: [{ category: "File Existence", pass_rate: 46.61 }],
    top_failing: [{ check: "tox_ini.uses_whitelist_externals", failing: 3 }],
    highlights: {
      top: [{ repo_name: "openedx/x", score_composite: 93.3, score_letter: "A" }],
      bottom: [{ repo_name: "openedx/y", score_composite: 46.7, score_letter: "C" }],
    },
    gainers: [{ repo_name: "openedx/z", score_composite: 80, baseline_score: 70, delta: 10 }],
    losers: [{ repo_name: "openedx/w", score_composite: 50, baseline_score: 60, delta: -10 }],
    movers: [
      { repo_name: "openedx/z", score_composite: 80, baseline_score: 70, delta: 10 },
      { repo_name: "openedx/w", score_composite: 50, baseline_score: 60, delta: -10 },
    ],
    movers_from: "2026-09-23",
    movers_to: "2026-10-02",
    ...overrides,
  };
}

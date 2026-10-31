import type { DriftRecord } from "./schemas";

export const SURFACES = ["card", "table", "detail", "attention", "overview_tile", "csv", "filter"] as const;
export type Surface = (typeof SURFACES)[number];

export const SURFACE_LABELS: Record<Surface, string> = {
  card: "fork cards",
  table: "apps table",
  detail: "app pages",
  attention: "needs attention",
  overview_tile: "overview",
  csv: "CSV download",
  filter: "filters",
};

export interface SignalInfo {
  key: string;
  label: string;
  description: string;
  /** The record field whose `null` means collecting this signal failed for that fork; absent when `null` is a normal value. */
  failureField?: keyof DriftRecord;
  /** Settings outside the signal's own entry that turning it on also needs. */
  requires?: string;
}

export const SIGNAL_CATALOGUE = [
  { key: "fork_release", label: "Our releases", description: "The newest stable tag we cut from the production branch, and a pending release candidate." },
  { key: "upstream_release", label: "Upstream releases", description: "Upstream's latest release, how far our branch is from it, and how many releases came out since our last sync." },
  { key: "release_gap", label: "Release gap", description: "Which upstream release we are built on and how many releases, and how big a version jump, we lack. Forks with no upstream release in their history are judged on commits instead." },
  { key: "advisories", label: "Security advisories", description: "Upstream GitHub security advisories published after our release, and those affecting the version we are built on.", failureField: "advisories" },
  { key: "promotion", label: "Promotion", description: "Commits on the staging branch not yet released to production. Apps that release from their own branch have none.", requires: "branches.staging, the name of the staging branch" },
  { key: "ci", label: "Checks", description: "Whether the checks on our release branch pass.", failureField: "ci" },
  { key: "pull_requests", label: "Pull requests", description: "Open pull requests against our release branch, and whether an upstream sync is open.", failureField: "pull_requests" },
  { key: "maintainers", label: "Maintainers", description: "Everyone who has merged a pull request into our release branch.", failureField: "maintainers" },
  { key: "upstream_activity", label: "Upstream activity", description: "When upstream last pushed, and whether it has gone quiet.", failureField: "upstream_activity" },
  {
    key: "licence_watch",
    label: "Licence watch",
    description: "Upstream's licence file on the branch we track: whether it changed recently, and whether it matches the licence we list.",
    failureField: "licence_watch",
  },
  {
    key: "exploitability",
    label: "Known exploited",
    description: "Upstream advisories that apply to our code and appear in CISA's catalog of known exploited vulnerabilities. Collected daily from CISA.",
    failureField: "exploitability",
  },
  { key: "conflicts", label: "Sync forecast", description: "The files a sync with upstream's head and latest release would conflict on. Collected weekly." },
  {
    key: "carried_patches",
    label: "Carried patches",
    description: "Our own commits on the production branch, and which of them upstream already has, so they drop at the next sync. Collected weekly.",
  },
  {
    key: "upgrade_risk",
    label: "Upgrade risk",
    description: "Database migrations both we and upstream added since our last sync, and upstream release notes since then that flag breaking changes or required steps. Collected weekly.",
  },
] as const satisfies readonly SignalInfo[];

export type SignalEntry = (typeof SIGNAL_CATALOGUE)[number];
export type SignalKey = SignalEntry["key"];

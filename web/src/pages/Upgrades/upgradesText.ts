export const INTRO =
  "Upgrade work across the org, from bot and human PRs alike: whether automated " +
  "requirement upgrades land, how far platform-wide upgrade waves have reached, and " +
  "upgrade PRs that are no longer needed. Collected daily from public GitHub data; read-only.";

export const MISSING_BODY =
  "It is published daily by the collect-maintenance workflow; check back after its next run.";

export const JOB_STATES = ["failing", "not_landing", "healthy"] as const;

export const STATE_LABELS: Record<string, string> = {
  failing: "Job failing",
  not_landing: "PRs not merged",
  healthy: "Healthy",
};

export const JOB_STATES_CAPTION =
  "Job failing: half or more of the last 10 runs failed, so no upgrade PR is produced. " +
  "PRs not merged: the job works, but no requirements PR has been merged for 4+ weeks.";

const PULL_NUMBER = /\/pull\/(\d+)$/;

export function missingTitle(what: string): string {
  return `No ${what} data yet.`;
}

export function collectedTime(collectedAt: string | null | undefined): string {
  return `${(collectedAt ?? "").slice(0, 16).replace("T", " ")} UTC`;
}

export function upgradeJobsCaption(collectedAt: string | null | undefined): string {
  return (
    "Each repo's weekly `upgrade-python-requirements.yml` job, from repo-tools' " +
    `\`check_requirements_failures\`. Collected ${collectedTime(collectedAt)}.`
  );
}

export function redundantCaption(collectedAt: string | null | undefined): string {
  return (
    "Bot campaign PRs made redundant by a later human campaign in the same repo. " +
    `Dry run: nothing has been closed. Collected ${collectedTime(collectedAt)}.`
  );
}

export function waveCaption(doneRule: string, collectedAt: string | null | undefined): string {
  return `Done means: ${doneRule}. Collected ${collectedTime(collectedAt)}.`;
}

export function waveProgressText(done: number, applicable: number, percentDone: number): string {
  return `${done} of ${applicable} repos done (${percentDone}%)`;
}

export function runsText(failed: number | null | undefined, total: number | null | undefined): string {
  return `${failed ?? ""} / ${total ?? ""}`;
}

export function pullLabel(url: string): string {
  const match = PULL_NUMBER.exec(url);
  return match ? `#${match[1]}` : url;
}

export function mergedText(value: string | boolean | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

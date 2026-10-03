import type { FailingChecksView, ReposView } from "../../data/schemas";

export type FailingCheckRow = FailingChecksView["records"][number];

export type RepoRow = ReposView["records"][number];

export const TOP_N = 15;

export const ALL_REPOSITORIES = "All repositories";

export function checkOptions(checks: readonly FailingCheckRow[]): string[] {
  return [ALL_REPOSITORIES, ...checks.map((row) => row.check)];
}

export function selectedCheck(choice: string): string | null {
  return choice === ALL_REPOSITORIES ? null : choice;
}

export function reposFailing(repos: readonly RepoRow[], check: string | null): readonly RepoRow[] {
  if (check === null) return repos;
  return repos.filter((repo) => repo.checks[check] === "fail");
}

export function capCaption(total: number): string | null {
  if (total <= TOP_N) return null;
  return `Showing the ${TOP_N} most-failed of ${total} failing checks. Use the selector below to inspect any of them.`;
}

export function byRepoName(a: RepoRow, b: RepoRow): number {
  if (a.repo_name === b.repo_name) return 0;
  return a.repo_name < b.repo_name ? -1 : 1;
}

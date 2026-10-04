import type { RepoDetailView, ReposView } from "../../data/schemas";

export type RepoDetail = RepoDetailView["repos"][string];
export type RepoRecord = ReposView["records"][number];

export function rawField(record: RepoRecord, column: string): unknown {
  return (record as Record<string, unknown>)[column];
}

export function findRecord(records: readonly RepoRecord[], repo: string | null): RepoRecord | undefined {
  return repo === null ? undefined : records.find((record) => record.repo_name === repo);
}

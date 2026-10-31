import { EmptyState } from "../../components/EmptyState";
import { pluralise } from "./rows";
import type { FailedRecord } from "./schemas";

export function collectionFailureTitle(failed: readonly FailedRecord[]): string {
  const repos = failed.map((record) => record.repo).sort((a, b) => a.localeCompare(b));
  return `Collection failed for ${pluralise(repos.length, "fork")}: ${repos.join(", ")}.`;
}

export function CollectionFailures({ failed }: { failed: readonly FailedRecord[] }) {
  if (failed.length === 0) return null;
  return (
    <EmptyState
      kind="warn"
      title={collectionFailureTitle(failed)}
      body="They are left out of every count and list on this site until the next daily run succeeds; yesterday's status survives in the history."
    />
  );
}

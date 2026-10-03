import { EmptyState } from "./EmptyState";

interface ErrorStateProps {
  title: string;
  detail?: string;
}

export function ErrorState({ title, detail }: ErrorStateProps) {
  return <EmptyState kind="error" title={title} body={detail} />;
}

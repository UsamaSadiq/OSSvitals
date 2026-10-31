import { isStatus, STATUS_LABELS } from "./rows";

export function StatusPill({ status }: { status: string }) {
  const known = isStatus(status);
  return <span className={`fork-status fork-status--${known ? status : "unknown"}`}>{known ? STATUS_LABELS[status] : status}</span>;
}

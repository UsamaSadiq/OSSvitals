export type ChipStatus = "pass" | "fail" | "warn" | "unknown";

const STATUSES: readonly string[] = ["pass", "fail", "warn", "unknown"];

export function chipStatus(value: string): ChipStatus {
  return STATUSES.includes(value) ? (value as ChipStatus) : "unknown";
}

export function StatusChip({ status, label }: { status: string; label: string }) {
  return <span className={`status-chip status-chip--${chipStatus(status)}`}>{label}</span>;
}

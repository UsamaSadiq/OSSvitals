import { Badge, type BadgeTone } from "../../components/Badge";

export type ChipStatus = "pass" | "fail" | "warn" | "unknown";

const TONES: Record<ChipStatus, BadgeTone> = { pass: "good", fail: "fail", warn: "warn", unknown: "neutral" };

export function chipStatus(value: string): ChipStatus {
  return value in TONES ? (value as ChipStatus) : "unknown";
}

export function StatusChip({ status, label }: { status: string; label: string }) {
  return <Badge tone={TONES[chipStatus(status)]}>{label}</Badge>;
}

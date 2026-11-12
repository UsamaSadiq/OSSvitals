import { Badge, type BadgeTone } from "../../components/Badge";
import type { SupportProduct } from "../../data/schemas";
import { STATUS_LABELS } from "./supportRows";

const STATUS_TONES: Record<SupportProduct["status"], BadgeTone> = {
  drift: "warn",
  eol: "fail",
  eol_soon: "warn",
  ok: "good",
  unknown: "neutral",
};

export function StatusChip({ product }: { product: SupportProduct }) {
  return <Badge tone={STATUS_TONES[product.status]}>{STATUS_LABELS[product.status]}</Badge>;
}

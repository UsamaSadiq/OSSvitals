import type { ReactNode } from "react";

export type BadgeTone = "good" | "warn" | "fail" | "info" | "neutral";

/** A status label: a soft fill, never an outline, so it cannot be mistaken for a clickable filter chip. */
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

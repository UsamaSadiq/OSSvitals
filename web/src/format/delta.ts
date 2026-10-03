export const NO_CHANGE = "no change";

export type DeltaKind = "int" | "float";

const FLOAT_NO_CHANGE_THRESHOLD = 0.05;

function signed(text: string, value: number): string {
  return value > 0 ? `+${text}` : text;
}

function formatFloatDelta(value: number): string {
  if (Math.abs(value) < FLOAT_NO_CHANGE_THRESHOLD) return NO_CHANGE;
  return signed(value.toFixed(1), value);
}

function formatIntDelta(value: number): string {
  if (value === 0) return NO_CHANGE;
  return signed(String(Math.trunc(value)), value);
}

export function formatDelta(value: number | null | undefined, kind: DeltaKind): string | null {
  if (value === null || value === undefined) return null;
  return kind === "float" ? formatFloatDelta(value) : formatIntDelta(value);
}

import type { SupportCycle, SupportProduct, SupportStatus, SupportWindowView } from "../../data/schemas";

export const STATUS_LABELS: Record<SupportStatus, string> = {
  drift: "Calendar out of date",
  eol: "Past end of life",
  eol_soon: "End of life within a year",
  ok: "Up to date",
  unknown: "Could not check",
};

export const STATUS_ORDER: readonly SupportStatus[] = ["drift", "eol", "eol_soon", "ok", "unknown"];

const DEFAULT_YEARS_BACK = 3;
const DEFAULT_YEARS_AHEAD = 4;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface TimeRange {
  start: number;
  end: number;
}

export interface Bar {
  left: number;
  width: number;
  openEnded: boolean;
}

function utcTime(iso: string): number {
  const [year = 1970, month = 1, day = 1] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function percent(value: number, range: TimeRange): number {
  return ((value - range.start) / (range.end - range.start)) * 100;
}

export function snapshotDay(view: SupportWindowView, fallback: Date = new Date()): Date {
  return view.collected_at ? new Date(utcTime(view.collected_at)) : fallback;
}

export function timeRange(window: SupportWindowView["window"], today: Date): TimeRange {
  const year = today.getUTCFullYear();
  return {
    start: Date.UTC(year - (window?.years_back ?? DEFAULT_YEARS_BACK), 0, 1),
    end: Date.UTC(year + (window?.years_ahead ?? DEFAULT_YEARS_AHEAD) + 1, 0, 1),
  };
}

export function yearTicks(range: TimeRange): { year: number; left: number }[] {
  const first = new Date(range.start).getUTCFullYear();
  const last = new Date(range.end).getUTCFullYear();
  return Array.from({ length: last - first }, (_, index) => first + index).map((year) => ({
    year,
    left: percent(Date.UTC(year, 0, 1), range),
  }));
}

export function todayOffset(today: Date, range: TimeRange): number {
  return percent(today.getTime(), range);
}

export function barFor(cycle: SupportCycle, range: TimeRange): Bar | null {
  const start = Math.max(utcTime(cycle.start), range.start);
  const end = Math.min(cycle.end ? utcTime(cycle.end) : range.end, range.end);
  if (end <= start) return null;
  return { left: percent(start, range), width: percent(end, range) - percent(start, range), openEnded: cycle.end === null };
}

export function monthLabel(iso: string | null): string {
  if (!iso) return "no end date published";
  const [year, month] = iso.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

export function cycleLabel(product: SupportProduct, cycle: SupportCycle): string {
  const span = `${monthLabel(cycle.start)} to ${monthLabel(cycle.end)}`;
  return `${product.label} ${cycle.cycle}, ${span}${cycle.current ? ", in use" : ""}`;
}

export function declaredText(product: SupportProduct): string {
  if (product.declared_kind === "follows_tutor") return "Follows Tutor";
  if (product.declared_kind === "missing") return "Not declared";
  return product.declared ?? "";
}

export function byStatus(products: readonly SupportProduct[]): SupportProduct[] {
  return [...products].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
}

export function drifted(products: readonly SupportProduct[]): SupportProduct[] {
  return products.filter((product) => product.status === "drift");
}

export function sourcesText(refs: SupportWindowView["refs"]): string {
  return Object.values(refs ?? {})
    .filter((ref) => ref.ref)
    .map((ref) => `${ref.repo} ${ref.ref}`)
    .join(", ");
}

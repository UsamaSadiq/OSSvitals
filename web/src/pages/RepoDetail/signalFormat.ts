import type { MetaView } from "../../data/schemas";
import { formatNumber, toFixedHalfEven } from "../../format";

export type Signal = MetaView["signals"][number];
export type SignalKind = Signal["kind"];

export interface SignalItem {
  label: string;
  value: string;
}

export interface SignalGroup {
  group: string;
  items: SignalItem[];
}

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

export const ACTIVITY_NOTE = "Counts and medians only; newcomers are PR authors with no earlier commit in the repo.";
export const UNMEASURED_NOTE =
  " Newcomer counts are hidden: this snapshot reports none for any repository, which is a collection gap.";

function formatDays(value: unknown): string {
  const days = Math.trunc(Number(value));
  return `${formatNumber(days)} day${days === 1 ? "" : "s"}`;
}

function formatDuration(value: unknown): string {
  const seconds = Number(value);
  if (seconds < SECONDS_PER_DAY) return `${toFixedHalfEven(seconds / SECONDS_PER_HOUR, 1)} h`;
  return `${toFixedHalfEven(seconds / SECONDS_PER_DAY, 1)} days`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

const FORMATTERS: Record<SignalKind, (value: unknown) => string> = {
  count: (value) => formatNumber(Math.trunc(Number(value))),
  ratio: (value) => `${toFixedHalfEven(Number(value) * 100, 0)}%`,
  days: formatDays,
  duration: formatDuration,
  state: (value) => capitalize(String(value).trim()),
};

export function formatSignal(kind: SignalKind, value: unknown): string {
  return FORMATTERS[kind](value);
}

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function signalItem(signal: Signal, record: Record<string, unknown>): SignalItem | null {
  const value = record[signal.column];
  return isPresent(value) ? { label: signal.label, value: formatSignal(signal.kind, value) } : null;
}

function appendItem(groups: readonly SignalGroup[], group: string, item: SignalItem): SignalGroup[] {
  const existing = groups.find((entry) => entry.group === group);
  if (!existing) return [...groups, { group, items: [item] }];
  return groups.map((entry) => (entry === existing ? { group, items: [...entry.items, item] } : entry));
}

export function repoSignals(
  signals: readonly Signal[],
  record: Record<string, unknown>,
  skip: readonly string[],
): SignalGroup[] {
  return signals
    .filter((signal) => !skip.includes(signal.column))
    .reduce<SignalGroup[]>((groups, signal) => {
      const item = signalItem(signal, record);
      return item ? appendItem(groups, signal.group, item) : groups;
    }, []);
}

export function activityNote(unmeasured: readonly string[]): string {
  return unmeasured.length > 0 ? ACTIVITY_NOTE + UNMEASURED_NOTE : ACTIVITY_NOTE;
}

import type { FreshnessBannerProps } from "../layout/FreshnessBanner";
import type { MetaView } from "./schemas";

const HOURS_PER_DAY = 24;
const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FreshnessLevel = FreshnessBannerProps["level"];

export interface FreshnessThresholds {
  staleHours: number;
  criticalHours: number;
}

export function snapshotDateOf(timestamp: string | null | undefined): string | null {
  const day = (timestamp ?? "").trim().slice(0, 10);
  if (!ISO_DATE.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return null;
  return day;
}

function utcDayNumber(value: Date): number {
  return Math.floor(value.getTime() / MS_PER_DAY);
}

export function snapshotAgeHours(snapshotDate: string, now: Date): number {
  const days = utcDayNumber(now) - utcDayNumber(new Date(`${snapshotDate}T00:00:00Z`));
  return Math.max(0, days * HOURS_PER_DAY);
}

export function freshnessLevel(ageHours: number, { staleHours, criticalHours }: FreshnessThresholds): FreshnessLevel {
  if (ageHours > criticalHours) return "critical";
  if (ageHours > staleHours) return "stale";
  return "fresh";
}

export function freshnessOf(meta: MetaView, now: Date = new Date()): FreshnessBannerProps {
  const snapshotDate = snapshotDateOf(meta.metadata.snapshot_timestamp);
  if (!snapshotDate) return { level: "unknown" };
  const ageHours = snapshotAgeHours(snapshotDate, now);
  const level = freshnessLevel(ageHours, {
    staleHours: meta.stale_threshold_hours,
    criticalHours: meta.critically_stale_threshold_hours,
  });
  if (level === "fresh") return { level };
  return { level, ageHours, snapshotDate, staleThresholdHours: meta.stale_threshold_hours };
}

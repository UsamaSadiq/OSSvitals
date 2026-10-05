import { formatNumber } from "../format";
import { gradeFill, gradeTotal, tipMark, type Chart, type GradeMix } from "./charts";
import type { MarkSpec } from "./chartSpec";
import { GRADE_ORDER, type Grade } from "./GradePill";

export const AREA_MIN_SNAPSHOTS = 8;

export interface GradeHistory {
  dates: readonly string[];
  counts: readonly GradeMix[];
}

export interface GradeBand {
  day: string;
  date: Date;
  grade: Grade;
  count: number;
  y1: number;
  y2: number;
  middle: number;
  fill: string;
  tip: string;
}

export interface GradeSnapshot {
  day: string;
  mix: GradeMix;
}

export function gradeSnapshots({ dates, counts }: GradeHistory): GradeSnapshot[] {
  return dates.flatMap((day, index) => {
    const mix = counts[index];
    return mix ? [{ day, mix }] : [];
  });
}

function bandTip(day: string, grade: Grade, count: number): string {
  return `${day}\nGrade ${grade}: ${formatNumber(count)} ${count === 1 ? "repository" : "repositories"}`;
}

function snapshotBands({ day, mix }: GradeSnapshot): GradeBand[] {
  const date = new Date(day);
  const tops = GRADE_ORDER.reduce<number[]>((acc, grade) => [...acc, (acc.at(-1) ?? 0) + mix[grade]], []);
  return GRADE_ORDER.map((grade, index) => {
    const y2 = tops[index] ?? 0;
    const y1 = y2 - mix[grade];
    return {
      day,
      date,
      grade,
      count: mix[grade],
      y1,
      y2,
      middle: (y1 + y2) / 2,
      fill: gradeFill(grade),
      tip: bandTip(day, grade, mix[grade]),
    };
  });
}

export function gradeBands(snapshots: readonly GradeSnapshot[]): GradeBand[] {
  return snapshots.flatMap(snapshotBands);
}

function changeVerb(from: number, to: number): string {
  if (to === from) return `held at ${formatNumber(to)}`;
  return `${to > from ? "grew" : "fell"} from ${formatNumber(from)} to ${formatNumber(to)}`;
}

export function gradeChangeText(grade: Grade, first: GradeMix, last: GradeMix): string {
  return `${grade} ${changeVerb(first[grade], last[grade])}`;
}

const HEADLINE_GRADES: readonly Grade[] = ["A", "F"];

export function gradeHistorySummary(snapshots: readonly GradeSnapshot[]): string | null {
  const first = snapshots[0];
  const last = snapshots.at(-1);
  if (!first || !last) return null;
  if (snapshots.length < 2) return `One snapshot so far (${first.day}).`;
  const changes = HEADLINE_GRADES.map((grade) => gradeChangeText(grade, first.mix, last.mix));
  return `${changes.join(" and ")} since ${first.day}.`;
}

function gradeHistoryAriaLabel(snapshots: readonly GradeSnapshot[]): string {
  const first = snapshots[0];
  const last = snapshots.at(-1);
  if (!first || !last) return "Repositories per grade over time: no snapshots";
  const changes = GRADE_ORDER.map((grade) => `${grade} ${first.mix[grade]} to ${last.mix[grade]}`);
  return `Repositories per grade over ${snapshots.length} snapshots from ${first.day} to ${last.day}: ${changes.join(", ")}`;
}

const BAND_EDGE = { stroke: "var(--page)", strokeWidth: 1 };

function bandMark(bands: readonly GradeBand[], stacked: "area" | "bars"): MarkSpec {
  if (stacked === "area") {
    return { type: "areaY", data: bands, options: { x: "date", y1: "y1", y2: "y2", z: "grade", fill: "fill", ...BAND_EDGE } };
  }
  return { type: "barY", data: bands, options: { x: "day", y1: "y1", y2: "y2", fill: "fill", ...BAND_EDGE } };
}

export function stackStyle(snapshots: readonly GradeSnapshot[]): "area" | "bars" {
  return snapshots.length >= AREA_MIN_SNAPSHOTS ? "area" : "bars";
}

export function monthDay(day: string): string {
  return day.slice(5, 10);
}

function xScale(snapshots: readonly GradeSnapshot[], stacked: "area" | "bars") {
  if (stacked === "area") return { label: null, type: "utc" as const };
  return { label: null, domain: snapshots.map((snapshot) => snapshot.day), padding: 0.3, tickFormat: monthDay };
}

export function gradeHistoryChart(history: GradeHistory): Chart {
  const snapshots = gradeSnapshots(history);
  const bands = gradeBands(snapshots);
  const stacked = stackStyle(snapshots);
  const ymax = Math.max(1, ...snapshots.map((snapshot) => gradeTotal(snapshot.mix)));
  const tipX = stacked === "area" ? "date" : "day";
  return {
    ariaLabel: gradeHistoryAriaLabel(snapshots),
    summary: gradeHistorySummary(snapshots),
    spec: {
      options: {
        height: 320,
        marginLeft: 56,
        marginBottom: 40,
        x: xScale(snapshots, stacked),
        y: { label: "Repositories", domain: [0, ymax], nice: true, grid: true },
        color: { type: "identity" },
      },
      marks: [
        bandMark(bands, stacked),
        tipMark(
          bands.filter((band) => band.count > 0),
          "xy",
          { x: tipX, y: "middle", title: "tip" },
        ),
      ],
    },
  };
}

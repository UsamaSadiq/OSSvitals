export interface Point {
  x: number;
  y: number;
}

export const GAUGE_CENTER: Point = { x: 120, y: 120 };
export const GAUGE_RADIUS = 92;
export const GAUGE_MAX = 100;

function clampScore(value: number): number {
  return Math.min(GAUGE_MAX, Math.max(0, value));
}

export function pointAt(value: number, radius: number, center: Point = GAUGE_CENTER): Point {
  const angle = Math.PI * (1 - clampScore(value) / GAUGE_MAX);
  return { x: center.x + radius * Math.cos(angle), y: center.y - radius * Math.sin(angle) };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function arcPath(from: number, to: number, radius: number = GAUGE_RADIUS): string {
  const start = pointAt(from, radius);
  const end = pointAt(to, radius);
  return `M ${round(start.x)} ${round(start.y)} A ${radius} ${radius} 0 0 1 ${round(end.x)} ${round(end.y)}`;
}

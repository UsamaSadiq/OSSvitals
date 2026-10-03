import { toFixedHalfEven } from "./fixed";

export function formatPercent(fraction: number, decimals = 0): string {
  return `${toFixedHalfEven(fraction * 100, decimals)}%`;
}

export function percentOf(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0;
}

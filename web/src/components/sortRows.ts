export type SortDirection = "ascending" | "descending";

export type SortValue = string | number;

export type Comparator<Row> = (a: Row, b: Row) => number;

function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { sensitivity: "base" });
}

export function sortRows<Row>(
  rows: readonly Row[],
  sortValue: (row: Row) => SortValue,
  direction: SortDirection,
  tieBreak: Comparator<Row> = () => 0,
): Row[] {
  const sign = direction === "ascending" ? 1 : -1;
  return [...rows].sort((a, b) => sign * compareValues(sortValue(a), sortValue(b)) || tieBreak(a, b));
}

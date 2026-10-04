import "./components.css";
import { useMemo, useState, type ReactNode } from "react";
import { sortRows, type Comparator, type SortDirection, type SortValue } from "./sortRows";

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  sortValue?: (row: Row) => SortValue;
  numeric?: boolean;
}

export interface SortState {
  key: string;
  direction: SortDirection;
}

interface DataTableProps<Row> {
  caption: string;
  captionHidden?: boolean;
  columns: Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  initialSort?: SortState;
  tieBreak?: Comparator<Row>;
  emptyMessage?: string;
  maxHeight?: string;
}

function defaultDirection<Row>(column: Column<Row>): SortDirection {
  return column.numeric ? "descending" : "ascending";
}

function nextSort<Row>(current: SortState | undefined, column: Column<Row>): SortState {
  if (current?.key !== column.key) return { key: column.key, direction: defaultDirection(column) };
  return { key: column.key, direction: current.direction === "ascending" ? "descending" : "ascending" };
}

function sortedRows<Row>(
  rows: readonly Row[],
  columns: Column<Row>[],
  sort: SortState | undefined,
  tieBreak: Comparator<Row> | undefined,
): readonly Row[] {
  const sortValue = columns.find((column) => column.key === sort?.key)?.sortValue;
  if (!sort || !sortValue) return rows;
  return sortRows(rows, sortValue, sort.direction, tieBreak);
}

function HeaderCell<Row>({
  column,
  sort,
  onSort,
}: {
  column: Column<Row>;
  sort: SortState | undefined;
  onSort: (column: Column<Row>) => void;
}) {
  const className = column.numeric ? "data-table__numeric" : undefined;
  if (!column.sortValue) {
    return (
      <th scope="col" className={className}>
        {column.header}
      </th>
    );
  }
  const active = sort?.key === column.key;
  return (
    <th scope="col" className={className} aria-sort={active ? sort.direction : "none"}>
      <button type="button" className="data-table__sort" onClick={() => onSort(column)}>
        {column.header}
        <span aria-hidden="true" className="data-table__sort-icon">
          {active ? (sort.direction === "ascending" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function DataTable<Row>({
  caption,
  captionHidden = false,
  columns,
  rows,
  rowKey,
  initialSort,
  tieBreak,
  emptyMessage = "No repositories to show.",
  maxHeight,
}: DataTableProps<Row>) {
  const [sort, setSort] = useState<SortState | undefined>(initialSort);
  const visibleRows = useMemo(() => sortedRows(rows, columns, sort, tieBreak), [rows, columns, sort, tieBreak]);

  if (rows.length === 0) return <p className="caption">{emptyMessage}</p>;

  return (
    <div
      className="table-scroll data-table__scroll"
      role="region"
      aria-label={`${caption}, scrollable`}
      tabIndex={0}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="data-table">
        <caption className={captionHidden ? "visually-hidden" : undefined}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <HeaderCell
                key={column.key}
                column={column}
                sort={sort}
                onSort={(clicked) => setSort((current) => nextSort(current, clicked))}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? "data-table__numeric" : undefined}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

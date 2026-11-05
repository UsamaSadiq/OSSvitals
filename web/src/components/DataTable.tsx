import "./components.css";
import { useId, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { sortRows, type Comparator, type SortDirection, type SortValue } from "./sortRows";

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  sortValue?: (row: Row) => SortValue;
  numeric?: boolean;
  align?: "start" | "center" | "end";
  /** Prose columns (reasons, rules, owners) wrap instead of widening the table. */
  wrap?: boolean;
  /** Secondary columns are hidden on narrow screens. */
  priority?: "primary" | "secondary";
}

export interface SortState {
  key: string;
  direction: SortDirection;
}

interface DataTableProps<Row> {
  /** The table's visible title, unless ``captionHidden``; it also names the table for assistive technology. */
  caption: string;
  captionHidden?: boolean;
  headingLevel?: 2 | 3 | 4;
  description?: ReactNode;
  count?: ReactNode;
  actions?: ReactNode;
  columns: Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  initialSort?: SortState;
  tieBreak?: Comparator<Row>;
  emptyMessage?: string;
  maxHeight?: string;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
}

function defaultDirection<Row>(column: Column<Row>): SortDirection {
  return column.numeric ? "descending" : "ascending";
}

export function nextSort<Row>(current: SortState | undefined, column: Column<Row>): SortState {
  if (current?.key !== column.key) return { key: column.key, direction: defaultDirection(column) };
  return { key: column.key, direction: current.direction === "ascending" ? "descending" : "ascending" };
}

function useSort(initialSort: SortState | undefined, controlled: SortState | undefined, onSortChange?: (sort: SortState) => void) {
  const [own, setOwn] = useState<SortState | undefined>(initialSort);
  const sort = onSortChange ? controlled : own;
  const change = (next: SortState) => (onSortChange ? onSortChange(next) : setOwn(next));
  return [sort, change] as const;
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

/**
 * Whether the table fits its box without scrolling sideways. A table that fits needs no scroll container, so its
 * header can stick to the page instead of to the box; a table with ``maxHeight`` always scrolls in its own box.
 */
function useFits(scrollsOwnBox: boolean): [(node: HTMLDivElement | null) => void, boolean] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [fits, setFits] = useState(false);
  useLayoutEffect(() => {
    if (scrollsOwnBox || !node || typeof ResizeObserver === "undefined") {
      setFits(false);
      return;
    }
    const measure = () => setFits(node.scrollWidth <= node.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [node, scrollsOwnBox]);
  return [setNode, !scrollsOwnBox && fits];
}

export function cellClass<Row>(column: Column<Row>): string | undefined {
  const align = column.align ?? (column.numeric ? "end" : "start");
  const classes = [
    column.numeric ? "data-table__numeric" : null,
    align === "center" ? "data-table__center" : null,
    align === "end" && !column.numeric ? "data-table__end" : null,
    column.wrap ? "data-table__wrap" : null,
    column.priority === "secondary" ? "data-table__col--secondary" : null,
  ].filter(Boolean);
  return classes.length ? classes.join(" ") : undefined;
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
  const className = cellClass(column);
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

function TitleBar({
  id,
  level,
  caption,
  count,
  actions,
  description,
}: {
  id: string;
  level: 2 | 3 | 4;
  caption: string;
  count?: ReactNode;
  actions?: ReactNode;
  description?: ReactNode;
}) {
  const Heading = `h${level}` as const;
  return (
    <div className="table-card__head">
      <Heading id={id} className="table-card__title">
        {caption}
      </Heading>
      {count != null && <span className="table-card__count">{count}</span>}
      {actions && <div className="table-card__actions">{actions}</div>}
      {description && <p className="table-card__desc">{description}</p>}
    </div>
  );
}

export function DataTable<Row>({
  caption,
  captionHidden = false,
  headingLevel = 3,
  description,
  count,
  actions,
  columns,
  rows,
  rowKey,
  initialSort,
  tieBreak,
  emptyMessage = "No repositories to show.",
  maxHeight,
  sort: controlledSort,
  onSortChange,
}: DataTableProps<Row>) {
  const titleId = useId();
  const [sort, setSort] = useSort(initialSort, controlledSort, onSortChange);
  const visibleRows = useMemo(() => sortedRows(rows, columns, sort, tieBreak), [rows, columns, sort, tieBreak]);
  const [scrollRef, fits] = useFits(Boolean(maxHeight));
  const titled = !captionHidden;
  const regionLabel = { "aria-label": `${caption}, scrollable` };
  const tableLabel = titled ? { "aria-labelledby": titleId } : {};

  return (
    <div className="table-card">
      {titled && (
        <TitleBar
          id={titleId}
          level={headingLevel}
          caption={caption}
          count={count}
          actions={actions}
          description={description}
        />
      )}
      {rows.length === 0 ? (
        <div className="table-card__empty">
          <EmptyState kind="info" title={emptyMessage} />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className={`data-table__scroll${fits ? " data-table__scroll--fits" : ""}`}
          role={fits ? undefined : "region"}
          {...(fits ? {} : regionLabel)}
          tabIndex={fits ? undefined : 0}
          style={maxHeight ? { maxHeight } : undefined}
        >
          <table className="data-table" {...tableLabel}>
            {captionHidden && <caption className="visually-hidden">{caption}</caption>}
            <thead>
              <tr>
                {columns.map((column) => (
                  <HeaderCell
                    key={column.key}
                    column={column}
                    sort={sort}
                    onSort={(clicked) => setSort(nextSort(sort, clicked))}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.key} className={cellClass(column)}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

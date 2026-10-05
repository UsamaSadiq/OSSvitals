import "./controls.css";

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPage(page: number, count: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), count);
}

export function pageSlice<Row>(rows: readonly Row[], page: number, pageSize: number): Row[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

interface PaginationProps {
  label: string;
  page: number;
  count: number;
  onPage: (page: number) => void;
}

export function Pagination({ label, page, count, onPage }: PaginationProps) {
  if (count <= 1) return null;
  return (
    <nav className="pagination" aria-label={label}>
      <button type="button" className="button-link" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="pagination__status" aria-live="polite">
        Page {page} of {count}
      </span>
      <button type="button" className="button-link" disabled={page >= count} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}

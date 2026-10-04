import { useSearchParams } from "react-router";
import { EmptyState } from "../../components/EmptyState";
import { QuerySelect, useQueryValue } from "../../components/QuerySelect";
import { useSiteMeta } from "../../layout/siteMeta";
import { CheckEntry } from "./CheckEntry";
import {
  ALL,
  CATEGORY_PARAM,
  DEFAULT_FILTER,
  FILTER_OPTIONS,
  FILTER_PARAM,
  shownCaption,
  visibleRows,
  type CheckRow,
  type FilterChoice,
} from "./checkRows";

function FilterRadios({ value }: { value: FilterChoice }) {
  const [params, setParams] = useSearchParams();
  const choose = (next: FilterChoice) => {
    const updated = new URLSearchParams(params);
    if (next === DEFAULT_FILTER) updated.delete(FILTER_PARAM);
    else updated.set(FILTER_PARAM, next);
    setParams(updated, { replace: true });
  };
  return (
    <fieldset className="check-filter">
      <legend>Filter</legend>
      {FILTER_OPTIONS.map((option) => (
        <label key={option}>
          <input
            type="radio"
            name="check-filter"
            value={option}
            checked={option === value}
            onChange={() => choose(option)}
          />{" "}
          {option}
        </label>
      ))}
    </fieldset>
  );
}

function CheckList({ repo, rows }: { repo: string; rows: readonly CheckRow[] }) {
  const { featureFlags } = useSiteMeta();
  if (rows.length === 0) {
    return (
      <EmptyState
        kind="info"
        title="No checks match this filter."
        body="Switch the filter to All, or pick a different category."
      />
    );
  }
  return (
    <div>
      {rows.map((row) => (
        <CheckEntry key={row.record.check} repo={repo} row={row} allowPr={featureFlags.enablePrTemplateGenerator} />
      ))}
    </div>
  );
}

interface ChecksSectionProps {
  repo: string;
  rows: readonly CheckRow[];
  categories: readonly string[];
}

export function ChecksSection({ repo, rows, categories }: ChecksSectionProps) {
  const filter = useQueryValue(FILTER_PARAM, FILTER_OPTIONS, DEFAULT_FILTER) as FilterChoice;
  const category = useQueryValue(CATEGORY_PARAM, categories, ALL);
  const shown = visibleRows(rows, filter, category);
  return (
    <section className="repo-detail-section" aria-labelledby="checks-heading">
      <h2 id="checks-heading">Checks</h2>
      <div className="check-controls">
        <FilterRadios value={filter} />
        <QuerySelect label="Category" param={CATEGORY_PARAM} options={categories} defaultValue={ALL} />
      </div>
      <p className="caption">{shownCaption(shown.length, rows.length)}</p>
      <CheckList repo={repo} rows={shown} />
    </section>
  );
}

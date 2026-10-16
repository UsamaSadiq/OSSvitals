import { useState } from "react";
import type { FixPr } from "../../data/schemas";
import { useSearchParams } from "react-router";
import { EmptyState } from "../../components/EmptyState";
import { QuerySelect, useQueryValue } from "../../components/QuerySelect";
import { SearchField } from "../../components/SearchField";
import { useSiteMeta } from "../../layout/siteMeta";
import { CheckEntry } from "./CheckEntry";
import {
  ALL,
  CATEGORY_PARAM,
  DEFAULT_FILTER,
  FILTER_OPTIONS,
  FILTER_PARAM,
  groupByCategory,
  searchChecks,
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

type FixPrs = Record<string, FixPr>;

function CheckGroupList({ repo, category, rows, fixPrs }: { repo: string; category: string; rows: readonly CheckRow[]; fixPrs: FixPrs }) {
  const { featureFlags } = useSiteMeta();
  return (
    <section className="check-group" aria-label={category}>
      <h3 className="check-group__heading">
        {category} <span className="check-group__count">({rows.length})</span>
      </h3>
      <ul className="check-list">
        {rows.map((row) => (
          <CheckEntry
            key={row.record.check}
            repo={repo}
            row={row}
            allowPr={featureFlags.enablePrTemplateGenerator}
            fixPr={fixPrs[row.record.check] ?? null}
          />
        ))}
      </ul>
    </section>
  );
}

interface CheckListProps {
  repo: string;
  rows: readonly CheckRow[];
  order: readonly string[];
  searching: boolean;
  fixPrs: FixPrs;
}

function CheckList({ repo, rows, order, searching, fixPrs }: CheckListProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        kind="info"
        title="No checks match this filter."
        body={searching ? "Clear the search, switch the filter to All, or pick a different category." : "Switch the filter to All, or pick a different category."}
      />
    );
  }
  return (
    <div>
      {groupByCategory(rows, order).map((group) => (
        <CheckGroupList key={group.category} repo={repo} category={group.category} rows={group.rows} fixPrs={fixPrs} />
      ))}
    </div>
  );
}

interface ChecksSectionProps {
  repo: string;
  rows: readonly CheckRow[];
  categories: readonly string[];
  fixPrs?: FixPrs;
}

export function ChecksSection({ repo, rows, categories, fixPrs = {} }: ChecksSectionProps) {
  const filter = useQueryValue(FILTER_PARAM, FILTER_OPTIONS, DEFAULT_FILTER) as FilterChoice;
  const category = useQueryValue(CATEGORY_PARAM, categories, ALL);
  const [query, setQuery] = useState("");
  const shown = searchChecks(visibleRows(rows, filter, category), query);
  return (
    <section className="repo-detail-section" aria-labelledby="checks-heading">
      <h2 id="checks-heading">Checks</h2>
      <div className="check-controls">
        <FilterRadios value={filter} />
        <QuerySelect label="Category" param={CATEGORY_PARAM} options={categories} defaultValue={ALL} />
        <div className="check-search">
          <SearchField label="Search checks" value={query} placeholder="Title or check name" onChange={setQuery} />
        </div>
      </div>
      <p className="caption">{shownCaption(shown.length, rows.length)}</p>
      <CheckList repo={repo} rows={shown} order={categories} searching={query.trim() !== ""} fixPrs={fixPrs} />
    </section>
  );
}

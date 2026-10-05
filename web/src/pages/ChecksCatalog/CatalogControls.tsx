import { FilterChip } from "../../components/FilterChip";
import type { ParamChanges } from "../../components/queryParams";
import { SearchField } from "../../components/SearchField";
import {
  CATALOG_FLAGS,
  CATALOG_PARAMS,
  FLAG_LABELS,
  flagCount,
  type CatalogFilters,
  type CheckRecord,
} from "./catalogData";

interface CatalogControlsProps {
  records: readonly CheckRecord[];
  review: ReadonlySet<string>;
  filters: CatalogFilters;
  onChange: (changes: ParamChanges) => void;
  summary: string;
  onClear?: () => void;
}

export function CatalogControls({ records, review, filters, onChange, summary, onClear }: CatalogControlsProps) {
  return (
    <div className="checks-catalog__controls">
      <div className="checks-catalog__search">
        <SearchField
          label="Search checks"
          value={filters.query}
          placeholder="Title or check name"
          onChange={(value) => onChange({ [CATALOG_PARAMS.query]: value })}
        />
      </div>
      <fieldset className="filter-chips">
        <legend>Show only</legend>
        {CATALOG_FLAGS.map((flag) => {
          const pressed = filters.flags.has(flag);
          return (
            <FilterChip key={flag} pressed={pressed} onToggle={() => onChange({ [CATALOG_PARAMS[flag]]: pressed ? null : "1" })}>
              {FLAG_LABELS[flag]}{" "}
              <span className="filter-chip__count">{flagCount(records, flag, review)}</span>
            </FilterChip>
          );
        })}
      </fieldset>
      <div className="checks-catalog__results">
        <p className="checks-catalog__count" role="status">
          {summary}
        </p>
        {onClear && (
          <button type="button" className="checks-catalog__clear" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

import { useId } from "react";
import { useSearchParams } from "react-router";
import { FilterChip } from "../../components/FilterChip";
import { useParamUpdater } from "../../components/queryParams";
import {
  FILTER_PARAMS,
  PARAMS,
  appOptions,
  countsIgnoringStatus,
  hasActiveFilters,
  licenceOptions,
  parseFilters,
  toggledStatuses,
  withoutHiddenFilters,
} from "./filters";
import { STATUS_LABELS, STATUS_ORDER, type ForkRow } from "./rows";
import { useSignalVisibility } from "./visibility";

const ANY = "";

function FacetSelect({
  label,
  anyLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  anyLabel: string;
  options: readonly string[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="query-select">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value ?? ANY} onChange={(event) => onChange(event.target.value || null)}>
        <option value={ANY}>{anyLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterBar({ rows, shown }: { rows: readonly ForkRow[]; shown: number }) {
  const [params, setParams] = useSearchParams();
  const update = useParamUpdater();
  const { isShown } = useSignalVisibility();
  const filters = withoutHiddenFilters(parseFilters(params), (key) => isShown(key, "filter"));
  const counts = countsIgnoringStatus(rows, filters);
  const clear = () => setParams((current) => withoutFilters(current), { replace: true });
  return (
    <div className="fork-filters" role="group" aria-label="Filter forks">
      <div className="fork-filters__chips">
        {STATUS_ORDER.map((status) => (
          <FilterChip
            key={status}
            pressed={filters.statuses.includes(status)}
            onToggle={() => update({ [PARAMS.status]: toggledStatuses(filters.statuses, status).join(",") || null })}
          >
            {`${STATUS_LABELS[status]} (${counts[status]})`}
          </FilterChip>
        ))}
        {isShown("advisories", "filter") && (
          <FilterChip pressed={filters.advisories} onToggle={() => update({ [PARAMS.advisories]: filters.advisories ? null : "1" })}>
            Advisories that apply
          </FilterChip>
        )}
        {isShown("promotion", "filter") && (
          <FilterChip pressed={filters.unpromoted} onToggle={() => update({ [PARAMS.unpromoted]: filters.unpromoted ? null : "1" })}>
            Not yet promoted
          </FilterChip>
        )}
        {isShown("fork_release", "filter") && (
          <FilterChip pressed={filters.noRelease} onToggle={() => update({ [PARAMS.noRelease]: filters.noRelease ? null : "1" })}>
            No release yet
          </FilterChip>
        )}
      </div>
      <div className="fork-filters__fields">
        <FacetSelect label="App" anyLabel="Any app" options={appOptions(rows)} value={filters.app} onChange={(value) => update({ [PARAMS.app]: value })} />
        <FacetSelect label="Licence" anyLabel="Any licence" options={licenceOptions(rows)} value={filters.licence} onChange={(value) => update({ [PARAMS.licence]: value })} />
      </div>
      <p className="fork-filters__summary" role="status">
        {shown} of {rows.length} forks
        {hasActiveFilters(filters) && (
          <>
            {" · "}
            <button type="button" className="fork-filters__clear" onClick={clear}>
              Clear filters
            </button>
          </>
        )}
      </p>
    </div>
  );
}

function withoutFilters(current: URLSearchParams): URLSearchParams {
  const updated = new URLSearchParams(current);
  FILTER_PARAMS.forEach((param) => updated.delete(param));
  return updated;
}

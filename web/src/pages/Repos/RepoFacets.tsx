import { useEffect, useId, useState } from "react";
import { FilterChip } from "../../components/FilterChip";
import { GRADE_ORDER } from "../../components/GradePill";
import { StarIcon } from "../../components/icons";
import type { ParamChanges } from "../../components/queryParams";
import { SearchField } from "../../components/SearchField";
import { formatNumber } from "../../format";
import { gradesParam, PARAMS, toggledGrades, type ExplorerFilters } from "./repoFilters";

export interface FailingOption {
  check: string;
  failing: number;
}

interface FacetsProps {
  filters: ExplorerFilters;
  options: { tier: readonly string[]; owner: readonly string[]; lifecycle: readonly string[]; fails: readonly FailingOption[] };
  onChange: (changes: ParamChanges) => void;
}

const ANY = "";

function FacetSelect({
  label,
  value,
  options,
  anyLabel,
  onChange,
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  anyLabel: string;
  onChange: (value: string | null) => void;
}) {
  const id = useId();
  if (options.length === 0) return null;
  return (
    <div className="query-select repos-facet">
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

function failingLabel(option: FailingOption): string {
  return `${option.check} (${formatNumber(option.failing)} failing)`;
}

function FailsPicker({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: readonly FailingOption[];
  onChange: (value: string | null) => void;
}) {
  const id = useId();
  const listId = useId();
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  if (options.length === 0) return null;
  const known = new Set(options.map((option) => option.check));
  const type = (next: string) => {
    setText(next);
    const trimmed = next.trim();
    if (trimmed === "") onChange(null);
    else if (known.has(trimmed)) onChange(trimmed);
  };
  return (
    <div className="search-field repos-facet repos-facet--wide">
      <label htmlFor={id}>Fails check</label>
      <input
        id={id}
        type="search"
        list={listId}
        value={text}
        placeholder="Type a check name"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => type(event.target.value)}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.check} value={option.check} label={failingLabel(option)} />
        ))}
      </datalist>
    </div>
  );
}

function GradeChips({ filters, onChange }: Pick<FacetsProps, "filters" | "onChange">) {
  return (
    <fieldset className="filter-chips">
      <legend>Grade</legend>
      {GRADE_ORDER.map((grade) => (
        <FilterChip
          key={grade}
          label={`Grade ${grade}`}
          pressed={filters.grades.includes(grade)}
          onToggle={() => onChange({ [PARAMS.grade]: gradesParam(toggledGrades(filters.grades, grade)) })}
        >
          <span className={`grade-dot grade-dot--${grade.toLowerCase()}`} aria-hidden="true" />
          {grade}
        </FilterChip>
      ))}
    </fieldset>
  );
}

function WatchedChip({ filters, onChange }: Pick<FacetsProps, "filters" | "onChange">) {
  return (
    <FilterChip pressed={filters.watched} onToggle={() => onChange({ [PARAMS.watched]: filters.watched ? null : "1" })}>
      <StarIcon className="filter-chip__icon" />
      Watched only
    </FilterChip>
  );
}

export function RepoFacets({ filters, options, onChange }: FacetsProps) {
  return (
    <div className="repos-facets">
      <div className="repos-facets__row">
        <div className="repos-facet repos-facet--wide">
          <SearchField
            label="Search repositories"
            value={filters.query}
            placeholder="Name or part of a name"
            onChange={(value) => onChange({ [PARAMS.query]: value })}
          />
        </div>
        <FacetSelect
          label="Tier"
          value={filters.tier}
          options={options.tier}
          anyLabel="Any tier"
          onChange={(value) => onChange({ [PARAMS.tier]: value })}
        />
        <FacetSelect
          label="Owner"
          value={filters.owner}
          options={options.owner}
          anyLabel="Any owner"
          onChange={(value) => onChange({ [PARAMS.owner]: value })}
        />
        <FacetSelect
          label="Lifecycle"
          value={filters.lifecycle}
          options={options.lifecycle}
          anyLabel="Any lifecycle"
          onChange={(value) => onChange({ [PARAMS.lifecycle]: value })}
        />
        <FailsPicker value={filters.fails} options={options.fails} onChange={(value) => onChange({ [PARAMS.fails]: value })} />
      </div>
      <div className="repos-facets__chips">
        <GradeChips filters={filters} onChange={onChange} />
        <WatchedChip filters={filters} onChange={onChange} />
      </div>
    </div>
  );
}

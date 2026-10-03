import { useId } from "react";
import { useSearchParams } from "react-router";

interface QuerySelectProps {
  label: string;
  param: string;
  options: readonly string[];
  defaultValue: string;
}

export function useQueryValue(param: string, options: readonly string[], defaultValue: string): string {
  const [params] = useSearchParams();
  const value = params.get(param);
  return value !== null && options.includes(value) ? value : defaultValue;
}

export function QuerySelect({ label, param, options, defaultValue }: QuerySelectProps) {
  const id = useId();
  const [params, setParams] = useSearchParams();
  const value = useQueryValue(param, options, defaultValue);
  const choose = (next: string) => {
    const updated = new URLSearchParams(params);
    if (next === defaultValue) updated.delete(param);
    else updated.set(param, next);
    setParams(updated, { replace: true });
  };
  return (
    <div className="query-select">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => choose(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

import { useCallback } from "react";
import { useSearchParams } from "react-router";

export type ParamChanges = Record<string, string | null>;

export function withParams(params: URLSearchParams, changes: ParamChanges): URLSearchParams {
  const updated = new URLSearchParams(params);
  Object.entries(changes).forEach(([key, value]) => {
    if (value === null || value === "") updated.delete(key);
    else updated.set(key, value);
  });
  return updated;
}

export function useParamUpdater(): (changes: ParamChanges) => void {
  const [, setParams] = useSearchParams();
  return useCallback(
    (changes: ParamChanges) => setParams((current) => withParams(current, changes), { replace: true }),
    [setParams],
  );
}

export function isFlagSet(params: URLSearchParams, key: string): boolean {
  return params.get(key) === "1";
}

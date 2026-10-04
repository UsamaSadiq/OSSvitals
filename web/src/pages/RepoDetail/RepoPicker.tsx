import { useId, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { pickerOptions, rankRepos } from "./repoRanking";

export const REPO_PARAM = "repo";

export function useSelectedRepo(): [string | null, (repo: string) => void] {
  const [params, setParams] = useSearchParams();
  const select = (repo: string) => {
    const updated = new URLSearchParams(params);
    if (repo) updated.set(REPO_PARAM, repo);
    else updated.delete(REPO_PARAM);
    setParams(updated, { replace: true });
  };
  return [params.get(REPO_PARAM) || null, select];
}

interface RepoPickerProps {
  repos: readonly string[];
  selected: string | null;
  initialQuery: string;
  onSelect: (repo: string) => void;
}

export function RepoPicker({ repos, selected, initialQuery, onSelect }: RepoPickerProps) {
  const searchId = useId();
  const selectId = useId();
  const [query, setQuery] = useState(initialQuery);
  const options = useMemo(() => pickerOptions(rankRepos(repos, query), selected), [repos, query, selected]);
  return (
    <div className="repo-picker">
      <div className="repo-picker__field">
        <label htmlFor={searchId}>Find repository</label>
        <input
          id={searchId}
          type="text"
          value={query}
          placeholder="fuzzy match…"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="repo-picker__field">
        <label htmlFor={selectId}>Repository</label>
        <select id={selectId} value={selected ?? ""} onChange={(event) => onSelect(event.target.value)}>
          {options.map((repo) => (
            <option key={repo} value={repo}>
              {repo}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

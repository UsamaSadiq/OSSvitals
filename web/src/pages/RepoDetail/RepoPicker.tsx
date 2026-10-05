import "./repoPicker.css";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router";
import { RepoName } from "../../components/RepoName";
import { nextIndex } from "../../search/paletteKeys";
import { rankRepos, sortedRepos } from "./repoRanking";

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

interface PickerState {
  query: string;
  filtering: boolean;
  open: boolean;
  active: number;
}

function closedState(query: string): PickerState {
  return { query, filtering: false, open: false, active: -1 };
}

export function pickerChoices(repos: readonly string[], state: Pick<PickerState, "query" | "filtering">): string[] {
  return state.filtering ? rankRepos(repos, state.query) : sortedRepos(repos);
}

function useSyncedState(initialQuery: string): [PickerState, (next: PickerState) => void] {
  const [state, setState] = useState(() => closedState(initialQuery));
  const [syncedQuery, setSyncedQuery] = useState(initialQuery);
  if (syncedQuery !== initialQuery) {
    setSyncedQuery(initialQuery);
    setState(closedState(initialQuery));
  }
  return [state, setState];
}

export function RepoPicker({ repos, selected, initialQuery, onSelect }: RepoPickerProps) {
  const inputId = useId();
  const listId = useId();
  const [state, setState] = useSyncedState(initialQuery);
  const choices = useMemo(() => pickerChoices(repos, state), [repos, state]);
  const hasActive = state.open && state.active >= 0 && state.active < choices.length;
  const activeId = hasActive ? `${listId}-${state.active}` : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const openAt = (active: number) => setState({ ...state, open: true, active });
  const selectedIndex = selected === null ? -1 : choices.indexOf(selected);
  const commit = (repo: string | undefined) => {
    if (!repo) return;
    setState(closedState(repo));
    onSelect(repo);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      if (!state.open) openAt(selectedIndex >= 0 ? selectedIndex : nextIndex(-1, choices.length, step));
      else openAt(nextIndex(state.active, choices.length, step));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (hasActive) commit(choices[state.active]);
      else if (state.filtering) commit(choices[0]);
    } else if (event.key === "Escape" && state.open) {
      event.preventDefault();
      setState({ ...state, open: false, active: -1 });
    }
  };

  return (
    <div className="repo-picker">
      <label htmlFor={inputId}>Repository</label>
      <div className="repo-combobox">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={state.open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          autoComplete="off"
          spellCheck={false}
          placeholder="Type to find a repository…"
          value={state.query}
          onChange={(event) => setState({ query: event.target.value, filtering: true, open: true, active: 0 })}
          onKeyDown={onKeyDown}
          onClick={() => !state.open && openAt(selectedIndex)}
          onBlur={() => setState({ ...state, open: false, active: -1 })}
        />
        <ul id={listId} role="listbox" aria-label="Repositories" className="repo-combobox__list" hidden={!state.open}>
          {choices.map((repo, index) => (
            <li
              key={repo}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === state.active}
              className={repo === selected ? "repo-combobox__option repo-combobox__option--current" : "repo-combobox__option"}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => index !== state.active && openAt(index)}
              onClick={() => commit(repo)}
            >
              <RepoName name={repo} />
            </li>
          ))}
          {choices.length === 0 && (
            <li role="option" aria-selected={false} aria-disabled="true" className="repo-combobox__empty">
              No repository matches.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

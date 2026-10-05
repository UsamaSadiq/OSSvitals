import { useEffect, useId, useRef, useState } from "react";
import "./controls.css";
import { SearchIcon } from "./icons";

interface SearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// The committed value lives in the URL, which updates asynchronously; a local draft keeps typing smooth
// and only an outside change (Clear filters, Back) replaces it.
export function useDraft(value: string, commit: (next: string) => void): [string, (next: string) => void] {
  const [draft, setDraft] = useState(value);
  const sent = useRef<string[]>([]);
  useEffect(() => {
    const position = sent.current.indexOf(value);
    if (position !== -1) {
      sent.current = sent.current.slice(position + 1);
      return;
    }
    sent.current = [];
    setDraft(value);
  }, [value]);
  const type = (next: string) => {
    sent.current = [...sent.current, next];
    setDraft(next);
    commit(next);
  };
  return [draft, type];
}

export function SearchField({ label, value, onChange, placeholder }: SearchFieldProps) {
  const id = useId();
  const [draft, type] = useDraft(value, onChange);
  return (
    <div className="search-field">
      <label htmlFor={id}>{label}</label>
      <div className="search-field__box">
        <SearchIcon className="search-field__icon" />
        <input
          id={id}
          type="search"
          value={draft}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => type(event.target.value)}
        />
      </div>
    </div>
  );
}

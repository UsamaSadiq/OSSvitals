import { SearchIcon } from "../components/icons";

function shortcutHint(): string {
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘K" : "Ctrl K";
}

export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="search-button"
      aria-label="Search"
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K /"
      title="Search repositories, checks, owners and pages"
      onClick={onClick}
    >
      <SearchIcon />
      <span className="search-button__label" aria-hidden="true">
        Search
      </span>
      <kbd className="search-button__kbd" aria-hidden="true">
        {shortcutHint()}
      </kbd>
    </button>
  );
}

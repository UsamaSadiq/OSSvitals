import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { GradePill } from "../components/GradePill";
import { CloseIcon, SearchIcon } from "../components/icons";
import { RepoName } from "../components/RepoName";
import { toFixedHalfEven } from "../format";
import { useSiteMeta } from "../layout/siteMeta";
import { visibleSections } from "../pages/catalog";
import { useTenant } from "../tenants/context";
import { searchSections, type PaletteItem, type PaletteSection } from "./paletteItems";
import { nextIndex, trappedFocusTarget } from "./paletteKeys";
import type { PaletteIndex } from "./usePaletteIndex";
import "./commandPalette.css";

interface CommandPaletteProps {
  onClose: () => void;
  onNavigate: (to: string) => void;
}

export function resultsAnnouncement(count: number, index: PaletteIndex): string {
  if (count === 0 && index.loading) return "Loading search data…";
  const results = count === 1 ? "1 result" : `${count} results`;
  return index.loading ? `${results}, still loading more` : results;
}

function optionId(listId: string, position: number): string {
  return `${listId}-option-${position}`;
}

function ItemLabel({ item }: { item: PaletteItem }) {
  if (item.section === "repos") return <RepoName name={item.label} />;
  return <span className="palette__label">{item.label}</span>;
}

function ItemMeta({ item }: { item: PaletteItem }) {
  return (
    <span className="palette__meta">
      {item.detail && <code className="palette__detail">{item.detail}</code>}
      {item.score !== undefined && <span className="palette__score">{toFixedHalfEven(item.score, 1)}</span>}
      {item.grade && <GradePill grade={item.grade} />}
    </span>
  );
}

interface ResultListProps {
  listId: string;
  sections: readonly PaletteSection[];
  active: number;
  onHover: (position: number) => void;
  onChoose: (item: PaletteItem) => void;
}

interface PositionedSection {
  section: PaletteSection;
  start: number;
}

export function withStartPositions(sections: readonly PaletteSection[]): PositionedSection[] {
  return sections.reduce<{ placed: PositionedSection[]; next: number }>(
    ({ placed, next }, section) => ({ placed: [...placed, { section, start: next }], next: next + section.items.length }),
    { placed: [], next: 0 },
  ).placed;
}

function ResultList({ listId, sections, active, onHover, onChoose }: ResultListProps) {
  return (
    <div id={listId} role="listbox" aria-label="Search results" className="palette__results">
      {withStartPositions(sections).map(({ section, start }) => (
        <div key={section.id} role="group" aria-labelledby={`${listId}-${section.id}`} className="palette__group">
          <div id={`${listId}-${section.id}`} role="presentation" className="palette__heading">
            {section.title}
          </div>
          {section.items.map((item, itemIndex) => {
            const position = start + itemIndex;
            return (
              <div
                key={item.id}
                id={optionId(listId, position)}
                role="option"
                aria-selected={position === active}
                className="palette__option"
                onMouseMove={() => onHover(position)}
                onMouseDown={(event: MouseEvent) => event.preventDefault()}
                onClick={() => onChoose(item)}
              >
                <ItemLabel item={item} />
                <ItemMeta item={item} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ResultsNote({ index, query, count }: { index: PaletteIndex; query: string; count: number }) {
  const { loadingNote } = useTenant().paletteCopy;
  if (index.loading) return <p className="palette__note">{loadingNote}</p>;
  if (count > 0) return null;
  return <p className="palette__note">No matches for “{query.trim()}”.</p>;
}

function Unavailable({ labels }: { labels: readonly string[] }) {
  if (labels.length === 0) return null;
  return <p className="palette__note palette__note--warn">Search could not load {labels.join(", ")}.</p>;
}

function PaletteDialog({ onClose, onNavigate, index }: CommandPaletteProps & { index: PaletteIndex }) {
  const { placeholder, ariaLabel } = useTenant().paletteCopy;
  const titleId = useId();
  const listId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const sections = useMemo(() => searchSections(index.items, query), [index.items, query]);
  const flat = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const activeIndex = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);
  const activeId = activeIndex === -1 ? undefined : optionId(listId, activeIndex);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const choose = (item: PaletteItem | undefined) => item && onNavigate(item.to);

  const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive(nextIndex(activeIndex, flat.length, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(flat[activeIndex]);
    }
  };

  const onDialogKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "Tab" && dialogRef.current) {
      const target = trappedFocusTarget(dialogRef.current, document.activeElement, event.shiftKey);
      if (target) {
        event.preventDefault();
        target.focus();
      }
    }
  };

  return (
    <div className="palette-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="palette"
        onKeyDown={onDialogKey}
      >
        <h2 id={titleId} className="visually-hidden">
          Search
        </h2>
        <div className="palette__field">
          <SearchIcon className="palette__search-icon" />
          <input
            type="text"
            role="combobox"
            aria-label={ariaLabel}
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            placeholder={placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
          />
          <button type="button" className="palette__close" aria-label="Close search" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <ResultList listId={listId} sections={sections} active={activeIndex} onHover={setActive} onChoose={choose} />
        <ResultsNote index={index} query={query} count={flat.length} />
        <Unavailable labels={index.unavailable} />
        <p className="visually-hidden" role="status" aria-live="polite">
          {resultsAnnouncement(flat.length, index)}
        </p>
        <p className="palette__hints" aria-hidden="true">
          <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}

export function CommandPalette(props: CommandPaletteProps) {
  const { featureFlags, pages: manifest } = useSiteMeta();
  const { sections, PaletteHost } = useTenant();
  const maintainerViews = featureFlags.enableMaintainerViews;
  const pages = useMemo(
    () => visibleSections(sections, { maintainerViews, manifest }).flatMap((section) => section.pages),
    [sections, maintainerViews, manifest],
  );
  return createPortal(
    <PaletteHost pages={pages} maintainerViews={maintainerViews}>
      {(index) => <PaletteDialog {...props} index={index} />}
    </PaletteHost>,
    document.body,
  );
}

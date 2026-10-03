import "./components.css";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: () => ReactNode;
}

const KEY_STEPS: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

export function Tabs({ label, tabs }: { label: string; tabs: TabItem[] }) {
  const baseId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = tabs[activeIndex] ?? tabs[0];
  const tabId = (tab: TabItem) => `${baseId}-tab-${tab.id}`;
  const panelId = (tab: TabItem) => `${baseId}-panel-${tab.id}`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const next = step(activeIndex, tabs.length);
    setActiveIndex(next);
    tabRefs.current[next]?.focus();
  };

  if (!active) return null;

  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab, index) => {
          const selected = tab === active;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={tabId(tab)}
              aria-selected={selected}
              aria-controls={panelId(tab)}
              tabIndex={selected ? 0 : -1}
              className="tabs__tab"
              onClick={() => setActiveIndex(index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="tabs__panel" role="tabpanel" id={panelId(active)} aria-labelledby={tabId(active)} tabIndex={0}>
        {active.content()}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type MouseEvent } from "react";

export interface PageSection {
  id: string;
  label: string;
}

export const SECTION_IDS = {
  scores: "repo-scores",
  activity: "repo-activity",
  catalog: "repo-catalog",
  categories: "repo-categories",
  checks: "repo-checks",
} as const;

export const REPO_SECTIONS: readonly PageSection[] = [
  { id: SECTION_IDS.scores, label: "Scores" },
  { id: SECTION_IDS.activity, label: "Activity" },
  { id: SECTION_IDS.catalog, label: "Catalog" },
  { id: SECTION_IDS.categories, label: "Categories" },
  { id: SECTION_IDS.checks, label: "Checks" },
];

const BAND_MARGIN = "-64px 0px -60% 0px";
const USER_SCROLL_EVENTS = ["wheel", "touchstart", "keydown"] as const;

export function firstVisible(order: readonly string[], visible: ReadonlySet<string>): string | null {
  return order.find((id) => visible.has(id)) ?? null;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function visibleAfter(visible: ReadonlySet<string>, entries: readonly IntersectionObserverEntry[]): Set<string> {
  return entries.reduce((next, entry) => {
    if (entry.isIntersecting) next.add(entry.target.id);
    else next.delete(entry.target.id);
    return next;
  }, new Set(visible));
}

function useCurrentSection(ids: readonly string[]): [string | null, (id: string) => void] {
  const [current, setCurrent] = useState<string | null>(ids[0] ?? null);
  const visible = useRef<ReadonlySet<string>>(new Set());
  const pinned = useRef(false);
  const key = ids.join(" ");

  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;
    const order = key.split(" ");
    const observer = new IntersectionObserver(
      (entries) => {
        visible.current = visibleAfter(visible.current, entries);
        const next = firstVisible(order, visible.current);
        if (next && !pinned.current) setCurrent(next);
      },
      { rootMargin: BAND_MARGIN },
    );
    order.map((id) => document.getElementById(id)).forEach((element) => element && observer.observe(element));
    const release = () => {
      pinned.current = false;
    };
    USER_SCROLL_EVENTS.forEach((type) => window.addEventListener(type, release, { passive: true }));
    return () => {
      observer.disconnect();
      USER_SCROLL_EVENTS.forEach((type) => window.removeEventListener(type, release));
    };
  }, [key]);

  // A jump may not bring the target to the top band (the last section, a short page), so it stays highlighted until the reader scrolls.
  const pin = (id: string) => {
    pinned.current = true;
    setCurrent(id);
  };
  return [current, pin];
}

function jumpTo(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView?.({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  target.focus({ preventScroll: true });
}

// Scrolling the strip itself, not scrollIntoView, so a smooth page scroll in progress is not interrupted.
function useCurrentLinkInView(current: string | null) {
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!nav || !link) return;
    const hidden = link.offsetLeft < nav.scrollLeft || link.offsetLeft + link.offsetWidth > nav.scrollLeft + nav.clientWidth;
    if (hidden) nav.scrollLeft = link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
  }, [current]);
  return navRef;
}

export function SectionNav({ sections }: { sections: readonly PageSection[] }) {
  const [current, pin] = useCurrentSection(sections.map((section) => section.id));
  const navRef = useCurrentLinkInView(current);
  const onClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    pin(id);
    jumpTo(id);
  };
  return (
    <nav ref={navRef} className="section-nav" aria-label="Repository sections">
      <ul>
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={current === section.id ? "location" : undefined}
              onClick={(event) => onClick(event, section.id)}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

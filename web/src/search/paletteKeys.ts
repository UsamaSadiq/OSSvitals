export function nextIndex(current: number, count: number, step: 1 | -1): number {
  if (count === 0) return -1;
  if (current < 0) return step === 1 ? 0 : count - 1;
  return (current + step + count) % count;
}

const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number", ""]);

export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
}

export function isPaletteToggle(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k";
}

export function isSlashOpen(event: KeyboardEvent): boolean {
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return false;
  return !isTextEntry(event.target);
}

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

export function trappedFocusTarget(container: HTMLElement, active: Element | null, backwards: boolean): HTMLElement | null {
  const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!first || !last) return null;
  if (backwards && (active === first || !container.contains(active))) return last;
  if (!backwards && (active === last || !container.contains(active))) return first;
  return null;
}

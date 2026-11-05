import { describe, expect, it, vi } from "vitest";
import { isStaleChunkError, reloadOnce } from "./staleChunk";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size;
    },
  };
}

describe("stale chunk handling", () => {
  it("recognises the browsers' messages for a missing page chunk", () => {
    expect(isStaleChunkError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/A-1.js"))).toBe(true);
    expect(isStaleChunkError(new TypeError("error loading dynamically imported module: https://x/assets/A-1.js"))).toBe(true);
    expect(isStaleChunkError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });

  it("reloads once per address, so a chunk missing for another reason cannot loop", () => {
    const storage = memoryStorage();
    const reload = vi.fn();

    expect(reloadOnce(storage, { href: "https://x/support_window", reload })).toBe(true);
    expect(reloadOnce(storage, { href: "https://x/support_window", reload })).toBe(false);
    expect(reloadOnce(storage, { href: "https://x/platform", reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does not reload when storage is unavailable", () => {
    const reload = vi.fn();
    const blocked = { ...memoryStorage(), getItem: () => { throw new Error("denied"); } } as Storage;

    expect(reloadOnce(undefined, { href: "https://x/", reload })).toBe(false);
    expect(reloadOnce(blocked, { href: "https://x/", reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

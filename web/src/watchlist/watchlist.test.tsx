import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWatchlistStore,
  parseWatchlist,
  toggledWatchlist,
  WATCHLIST_KEY,
  watchlistStore,
  type KeyValueStorage,
} from "./watchlist";
import { WatchButton } from "./WatchButton";
import { baselineScore, scoreDelta, watchRows } from "./watchRows";

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

function throwingStorage(): KeyValueStorage {
  return {
    getItem: () => {
      throw new DOMException("denied", "SecurityError");
    },
    setItem: () => {
      throw new DOMException("quota", "QuotaExceededError");
    },
  };
}

describe("watchlist parsing", () => {
  it("reads a JSON list of names and drops duplicates", () => {
    expect(parseWatchlist('["openedx/a","openedx/b","openedx/a"]')).toEqual(["openedx/a", "openedx/b"]);
  });

  it("treats missing, malformed or wrongly shaped values as empty", () => {
    expect(parseWatchlist(null)).toEqual([]);
    expect(parseWatchlist("{not json")).toEqual([]);
    expect(parseWatchlist('{"a":1}')).toEqual([]);
    expect(parseWatchlist("[1,2]")).toEqual([]);
  });

  it("toggles a name without mutating the list", () => {
    const list = ["openedx/a"];
    expect(toggledWatchlist(list, "openedx/b")).toEqual(["openedx/a", "openedx/b"]);
    expect(toggledWatchlist(list, "openedx/a")).toEqual([]);
    expect(list).toEqual(["openedx/a"]);
  });
});

describe("watchlist store", () => {
  it("persists toggles under the ossvitals-watchlist key and notifies subscribers", () => {
    const storage = memoryStorage();
    const store = createWatchlistStore(() => storage);
    const listener = vi.fn();
    store.subscribe(listener);

    store.toggle("openedx/a");

    expect(storage.data[WATCHLIST_KEY]).toBe('["openedx/a"]');
    expect(store.getSnapshot()).toEqual(["openedx/a"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("restores the list saved by an earlier visit", () => {
    const store = createWatchlistStore(() => memoryStorage({ [WATCHLIST_KEY]: '["openedx/x"]' }));
    expect(store.getSnapshot()).toEqual(["openedx/x"]);
  });

  it("keeps a stable snapshot between changes", () => {
    const store = createWatchlistStore(() => memoryStorage());
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("works in memory when storage throws", () => {
    const store = createWatchlistStore(throwingStorage);
    expect(store.getSnapshot()).toEqual([]);
    store.toggle("openedx/a");
    expect(store.getSnapshot()).toEqual(["openedx/a"]);
  });

  it("works in memory when there is no storage at all", () => {
    const store = createWatchlistStore(() => null);
    store.toggle("openedx/a");
    expect(store.getSnapshot()).toEqual(["openedx/a"]);
  });
});

describe("WatchButton", () => {
  beforeEach(() => {
    window.localStorage.clear();
    watchlistStore.reload();
  });

  afterEach(() => vi.restoreAllMocks());

  it("toggles aria-pressed and saves the repository", async () => {
    render(<WatchButton repo="openedx/a" />);
    const button = screen.getByRole("button", { name: "Watch" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem(WATCHLIST_KEY)).toBe('["openedx/a"]');

    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("names the repository in its compact form and keeps buttons in sync", async () => {
    render(
      <>
        <WatchButton repo="openedx/a" compact />
        <WatchButton repo="openedx/a" />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Watch openedx/a" }));
    expect(screen.getByRole("button", { name: "Watch" })).toHaveAttribute("aria-pressed", "true");
  });

  it("still toggles when localStorage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    watchlistStore.reload();
    render(<WatchButton repo="openedx/a" />);

    await userEvent.click(screen.getByRole("button", { name: "Watch" }));

    expect(screen.getByRole("button", { name: "Watch" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("watch rows", () => {
  const points = [
    ["2026-08-01", 80, "B"],
    ["2026-09-10", null, null],
    ["2026-09-25", 90, "A"],
    ["2026-10-02", 93.5, "A"],
  ] as const;

  it("takes the earliest scored point within the window as the baseline", () => {
    expect(baselineScore(points.map((point) => [...point]), 30)).toBe(90);
    expect(baselineScore(points.map((point) => [...point]), 90)).toBe(80);
  });

  it("has no baseline with a single scored point", () => {
    expect(baselineScore([["2026-10-02", 93.5, "A"]], 30)).toBeNull();
    expect(scoreDelta(93.5, undefined, 30)).toBeNull();
  });

  it("joins the watchlist with scores in watch order", () => {
    const record = {
      repo_name: "openedx/a",
      score_composite: 93.5,
      score_letter: "A" as const,
      checks: {},
      category_stats: {},
      owner_handles: [],
    };
    const rows = watchRows(["openedx/gone", "openedx/a"], [record], { "openedx/a": points.map((point) => [...point]) }, 30);
    expect(rows).toEqual([
      { repo: "openedx/gone", record: null, delta: null },
      { repo: "openedx/a", record, delta: 3.5 },
    ]);
  });
});

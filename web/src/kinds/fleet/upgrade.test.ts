import { describe, expect, it } from "vitest";
import { migrationsNotice, releaseNotesNotice, upgradeNotices } from "./upgrade";

const migrations = { ours: 1, upstream: 2, shared_dirs: [] as string[], same_prefix: [], ours_items: [], upstream_items: [] };
const notes = { basis: "commits" as const, since: null, releases: 2, flagged: [] as { tag: string; url: string | null; published_at: string | null; lines: string[] }[] };

describe("upgrade notices", () => {
  it("stay quiet when nothing overlaps or is flagged", () => {
    expect(migrationsNotice(migrations)).toBeNull();
    expect(releaseNotesNotice(notes)).toBeNull();
    expect(upgradeNotices({ repo: "a", migrations, release_notes: notes })).toEqual([]);
    expect(upgradeNotices({ repo: "a", error: "clone failed" })).toEqual([]);
  });

  it("name shared migration folders and flagged releases since our last sync", () => {
    expect(migrationsNotice({ ...migrations, shared_dirs: ["db/migrate", "server/migrations"] })).toBe(
      "We and upstream both added migrations in db/migrate, server/migrations since our last sync",
    );
    const flagged = [{ tag: "7.2.2", url: null, published_at: null, lines: ["Manual migration required"] }];
    expect(releaseNotesNotice({ ...notes, flagged })).toBe("1 upstream release since our last sync flags breaking changes or required upgrade steps");
    expect(releaseNotesNotice({ ...notes, flagged: [...flagged, ...flagged] })).toBe("2 upstream releases since our last sync flag breaking changes or required upgrade steps");
  });
});

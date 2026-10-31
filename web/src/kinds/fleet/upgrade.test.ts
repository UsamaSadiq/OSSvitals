import { describe, expect, it } from "vitest";
import { migrationsNotice, releaseNotesNotice, upgradeNotices } from "./upgrade";

const migrations = { ours: 1, upstream: 2, shared_dirs: [] as string[], sequential_dirs: [] as string[], same_prefix: [] as { dir: string; prefix: string; ours: string[]; upstream: string[] }[] };
const notes = { basis: "commits" as const, since: null, releases: 2, flagged: [] as { tag: string; url: string | null; published_at: string | null; lines: string[] }[] };

describe("upgrade notices", () => {
  it("stay quiet when nothing is flagged, including timestamped migrations side by side", () => {
    expect(migrationsNotice({ ...migrations, shared_dirs: ["db/migrate"] })).toBeNull();
    expect(releaseNotesNotice(notes)).toBeNull();
    expect(upgradeNotices({ repo: "a", migrations, release_notes: notes })).toEqual([]);
    expect(upgradeNotices({ repo: "a", error: "clone failed" })).toEqual([]);
  });

  it("call out a shared migration number first, then numbered migrations on both sides", () => {
    const clash = { dir: "app/migrations", prefix: "0042", ours: ["0042_a.py"], upstream: ["0042_b.py"] };
    expect(migrationsNotice({ ...migrations, same_prefix: [clash] })).toBe("1 migration number in app/migrations is used by both us and upstream");
    expect(migrationsNotice({ ...migrations, sequential_dirs: ["app/migrations"] })).toBe("We and upstream both added numbered migrations in app/migrations since our last sync");
  });

  it("count flagged releases above our base, or since our last sync", () => {
    const flagged = [{ tag: "7.2.2", url: null, published_at: null, lines: ["Manual migration required"] }];
    expect(releaseNotesNotice({ ...notes, flagged })).toBe("1 upstream release since our last sync flags breaking changes or required upgrade steps");
    expect(releaseNotesNotice({ ...notes, since: "7.2.1", flagged: [...flagged, ...flagged] })).toBe("2 upstream releases after 7.2.1 flag breaking changes or required upgrade steps");
  });
});

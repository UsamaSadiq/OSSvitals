import { describe, expect, it } from "vitest";
import {
  appsSchema,
  conflictsSchema,
  driftSchema,
} from "../../web/src/kinds/fleet/schemas.ts";
import appsJson from "./fixtures/moneta/views/apps.json";
import conflictsJson from "./fixtures/moneta/views/conflicts.json";
import driftJson from "./fixtures/moneta/views/drift.json";
import { getApp, getConflictForecast, listApps, projectConflicts } from "../src/projections/fleet.ts";

const apps = appsSchema.parse(appsJson);
const drift = driftSchema.parse(driftJson);
const conflicts = conflictsSchema.parse(conflictsJson);

describe("driftSchema", () => {
  it("drops a fork whose collection failed instead of rejecting the whole view", () => {
    const withFailure = { ...driftJson, records: [...driftJson.records, { repo: "broken", error: "HTTP 502" }] };
    expect(driftSchema.parse(withFailure).records.map((record) => record.repo)).toEqual(drift.records.map((record) => record.repo));
  });
});

describe("listApps", () => {
  it("joins a fork with its drift record", () => {
    const alpha = listApps(apps, drift, {}).find((entry) => entry.repo === "alpha");
    expect(alpha).toMatchObject({
      class: "fork",
      status: "critical",
      ahead_by: 12,
      behind_by: 2500,
      upstream: "up/alpha",
      production_branch: "foss-main",
      latest_tag: "v1.0.0",
      open_pull_requests: 2,
      severe_since_fork_release: 2,
    });
  });

  it("gives originals without drift a null status and null distances", () => {
    const tool = listApps(apps, drift, {}).find((entry) => entry.repo === "tool");
    expect(tool).toMatchObject({
      class: "original",
      status: null,
      ahead_by: null,
      behind_by: null,
      behind_release: null,
      severe_since_fork_release: null,
      severe_since_our_code: null,
    });
  });

  it("lists the severe advisories since the upstream code we ship", () => {
    const records = drift.records.map((entry) =>
      entry.repo === "alpha" && entry.advisories ? { ...entry, advisories: { ...entry.advisories, severe_since_our_code: 4 } } : entry,
    );
    expect(listApps(apps, { ...drift, records }, {}).find((entry) => entry.repo === "alpha")).toMatchObject({ severe_since_our_code: 4 });
  });

  it("filters by status and class", () => {
    expect(listApps(apps, drift, { status: "critical" }).map((entry) => entry.repo)).toEqual(["alpha"]);
    expect(listApps(apps, drift, { status: "CRITICAL" }).map((entry) => entry.repo)).toEqual(["alpha"]);
    const originals = listApps(apps, drift, { class: "original" }).map((entry) => entry.repo);
    expect(originals).toEqual(["alpha-mcp", "tool"]);
    expect(listApps(apps, drift, { status: "critical", class: "original" })).toEqual([]);
  });
});

describe("getApp", () => {
  it("merges the app with drift and keeps only advisory counts", () => {
    const app = getApp(apps, drift, "ALPHA");
    expect(app).toMatchObject({ repo: "alpha", url: "https://github.com/Pressingly/alpha", status: "critical" });
    expect(app?.advisories).toMatchObject({ published: 3, severe_since_fork_release: 2 });
    for (const dropped of ["items", "promotion", "maintainers", "upstream_activity", "pull_requests", "ci"]) {
      expect(app).not.toHaveProperty(dropped);
    }
    expect(app?.advisories).not.toHaveProperty("items");
  });

  it("returns undefined for an unknown repo", () => {
    expect(getApp(apps, drift, "nope")).toBeUndefined();
  });

  it("returns null advisories and releases for a tenant that does not collect them", () => {
    const record = drift.records.find((entry) => entry.repo === "alpha");
    const { advisories: _advisories, fork_release: _fork, upstream_release: _upstream, ...core } = record!;
    const app = getApp(apps, { ...drift, records: [core] }, "alpha");
    expect(app).toMatchObject({ advisories: null, fork_release: null, upstream_release: null, licence_watch: null, exploitability: null, upstream_health: null });
    expect(listApps(apps, { ...drift, records: [core] }, {})[0]).toMatchObject({ severe_since_fork_release: null });
  });

  it("truncates long descriptions and change notes to 300 characters", () => {
    const long = "x".repeat(500);
    const [first, ...rest] = apps.records;
    if (!first) throw new Error("fixture is empty");
    const view = { ...apps, records: [{ ...first, description: long, what_we_changed: long }, ...rest] };
    const app = getApp(view, drift, first.repo);
    expect(app?.description).toBe(`${"x".repeat(300)}…`);
    expect(app?.what_we_changed).toBe(`${"x".repeat(300)}…`);
  });
});

describe("getConflictForecast", () => {
  it("projects head and release forecasts", () => {
    expect(getConflictForecast(conflicts, "alpha")).toEqual({
      repo: "alpha",
      against_upstream_head: {
        clean: false,
        conflicted_total: 2,
        conflicted_files: ["server/auth.py", "app/login.tsx"],
      },
      against_upstream_release: { tag: "v2.1.0", clean: true, conflicted_total: 0, conflicted_files: [] },
    });
  });

  it("carries the error and nulls missing forecasts", () => {
    expect(getConflictForecast(conflicts, "beta")).toMatchObject({
      repo: "beta",
      error: "clone failed",
      against_upstream_release: null,
    });
  });

  it("returns undefined for an unknown repo", () => {
    expect(getConflictForecast(conflicts, "nope")).toBeUndefined();
  });

  it("caps conflicted files at 50", () => {
    const files = Array.from({ length: 80 }, (_, index) => `f${index}.py`);
    const projected = projectConflicts({
      repo: "big",
      against_upstream_head: { clean: false, conflicted_files: files, conflicted_total: 80 },
    });
    expect(projected.against_upstream_head?.conflicted_files).toHaveLength(50);
    expect(projected.against_upstream_head?.conflicted_total).toBe(80);
  });
});

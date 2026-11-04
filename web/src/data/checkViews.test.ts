import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkViews, type ReadView } from "./checkViews";

const MONETA = resolve(__dirname, "../../../tests/fixtures/moneta/views");

// Moneta pins nothing, so it publishes no pins.json: a missing file reads as absent, as it does in validate-data.
function fixture(file: string): unknown {
  const path = resolve(MONETA, file);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
}

function readFrom(views: Record<string, unknown>): ReadView {
  return async (file) => views[file];
}

describe("checkViews", () => {
  it("accepts the published fleet fixtures", async () => {
    const results = await checkViews("fleet", async (file) => fixture(file));
    expect(results.filter((result) => result.outcome !== "ok").map(({ file, outcome }) => [file, outcome])).toEqual([["pins.json", "absent"]]);
  });

  it("lets a fleet tenant skip optional views but not apps or drift", async () => {
    const results = await checkViews("fleet", readFrom({ "apps.json": fixture("apps.json") }));
    const outcome = Object.fromEntries(results.map((result) => [result.file, result.outcome]));
    expect(outcome).toMatchObject({ "apps.json": "ok", "drift.json": "fail", "conflicts.json": "absent", "meta.json": "fail" });
  });

  it("names the file and the field when a fleet view has the wrong shape", async () => {
    const drift = fixture("drift.json") as { metadata: object; records: unknown[] };
    const broken = { ...drift, records: [{ repo: "alpha", status: 7 }] };
    const results = await checkViews("fleet", readFrom({ "apps.json": fixture("apps.json"), "drift.json": broken }));
    const failed = results.find((result) => result.file === "drift.json");
    expect(failed?.outcome).toBe("fail");
    expect(failed?.message).toMatch(/^drift\.json: .*status/s);
  });

  it("checks a fleet meta.json with the site check the data host must pass", async () => {
    const meta = fixture("meta.json") as { metadata: object };
    const bumped = { ...meta, metadata: { ...meta.metadata, schema_version: 99 } };
    const results = await checkViews("fleet", async (file) => (file === "meta.json" ? bumped : fixture(file)));
    expect(results.find((result) => result.file === "meta.json")).toMatchObject({ outcome: "fail", message: expect.stringMatching(/schema_version 99/) });
  });

  it("marks which failures are in optional views", async () => {
    const results = await checkViews("fleet", async (file) => (file === "updates.json" ? {} : fixture(file)));
    expect(results.filter((result) => result.outcome === "fail").map(({ file, required }) => [file, required])).toEqual([["updates.json", false]]);
  });

  it("requires every health view", async () => {
    const results = await checkViews("health", readFrom({}));
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.outcome === "fail" && result.message?.endsWith("missing"))).toBe(true);
  });

  it("reports unreadable JSON as a failure, not a crash", async () => {
    const results = await checkViews("fleet", async () => {
      throw new SyntaxError("Unexpected token");
    });
    expect(results.every((result) => result.outcome === "fail")).toBe(true);
  });
});

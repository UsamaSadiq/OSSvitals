import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkViews, type ReadView } from "./checkViews";

const MONETA = resolve(__dirname, "../../../tests/fixtures/moneta/views");

function fixture(file: string): unknown {
  return JSON.parse(readFileSync(resolve(MONETA, file), "utf8"));
}

function readFrom(views: Record<string, unknown>): ReadView {
  return async (file) => views[file];
}

describe("checkViews", () => {
  it("accepts the published fleet fixtures", async () => {
    const results = await checkViews("fleet", async (file) => fixture(file));
    expect(results.filter((result) => result.outcome !== "ok")).toEqual([]);
  });

  it("lets a fleet tenant skip optional views but not apps or drift", async () => {
    const results = await checkViews("fleet", readFrom({ "apps.json": fixture("apps.json") }));
    const outcome = Object.fromEntries(results.map((result) => [result.file, result.outcome]));
    expect(outcome).toMatchObject({ "apps.json": "ok", "drift.json": "fail", "conflicts.json": "absent", "meta.json": "absent" });
  });

  it("names the file and the field when a fleet view has the wrong shape", async () => {
    const drift = fixture("drift.json") as { metadata: object; records: unknown[] };
    const broken = { ...drift, records: [{ repo: "alpha", status: 7 }] };
    const results = await checkViews("fleet", readFrom({ "apps.json": fixture("apps.json"), "drift.json": broken }));
    const failed = results.find((result) => result.file === "drift.json");
    expect(failed?.outcome).toBe("fail");
    expect(failed?.message).toMatch(/^drift\.json: .*status/s);
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

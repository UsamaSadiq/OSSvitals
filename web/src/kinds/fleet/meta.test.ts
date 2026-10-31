import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { metaSchema } from "../../data/schemas";

const FIXTURE = resolve(__dirname, "../../../../tests/fixtures/moneta/views/meta.json");

describe("fleet meta.json", () => {
  it("is accepted by the site settings schema every tenant shares", () => {
    const meta = JSON.parse(readFileSync(FIXTURE, "utf8"));
    expect(meta.kind).toBe("fleet");
    expect(metaSchema.safeParse(meta).success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { metadata } from "../../data/fixtures";
import { updatesSchema } from "./schemas";

describe("fleet url fields", () => {
  const update = (url: unknown) => ({ date: "2026-10-01", title: "Release", url, repo: "a" });

  it.each(["javascript:alert(1)", "data:text/html,x"])("degrades %s to null without failing the view", (url) => {
    const parsed = updatesSchema.parse({ metadata: metadata("updates"), records: [update(url)] });
    expect(parsed.records[0]?.url).toBeNull();
  });

  it("keeps a web url", () => {
    const parsed = updatesSchema.parse({ metadata: metadata("updates"), records: [update("https://github.com/a/b")] });
    expect(parsed.records[0]?.url).toBe("https://github.com/a/b");
  });
});

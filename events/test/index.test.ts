import { parseGapMs, parseOrg } from "../src/index.ts";

describe("parseGapMs", () => {
  it("defaults to five minutes when unset or blank", () => {
    expect(parseGapMs(undefined)).toBe(5 * 60_000);
    expect(parseGapMs("")).toBe(5 * 60_000);
  });

  it("converts configured minutes to milliseconds, allowing zero", () => {
    expect(parseGapMs("2")).toBe(120_000);
    expect(parseGapMs("0")).toBe(0);
  });

  it("rejects NaN and negative values", () => {
    expect(() => parseGapMs("abc")).toThrow("MIN_DISPATCH_GAP_MINUTES");
    expect(() => parseGapMs("-1")).toThrow("MIN_DISPATCH_GAP_MINUTES");
  });
});

describe("parseOrg", () => {
  it("defaults to openedx", () => {
    expect(parseOrg(undefined)).toBe("openedx");
  });

  it("accepts a tenant slug and rejects anything else", () => {
    expect(parseOrg("edly")).toBe("edly");
    expect(() => parseOrg("Edly Org")).toThrow("ORG");
    expect(() => parseOrg("")).toThrow("ORG");
  });
});

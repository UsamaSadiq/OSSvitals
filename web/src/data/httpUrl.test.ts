import { describe, expect, it } from "vitest";
import { z } from "zod";
import { httpUrl, isHttpUrl, optionalHttpUrl } from "./httpUrl";

const HOSTILE_URLS = [
  "javascript:alert(1)",
  " javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
  "//evil.example/path",
  "/relative/path",
  "not a url",
  "",
];

describe("isHttpUrl", () => {
  it.each(["https://example.org/a?b=1", "http://example.org"])("accepts %s", (value) => {
    expect(isHttpUrl(value)).toBe(true);
  });

  it.each(HOSTILE_URLS)("rejects %j", (value) => {
    expect(isHttpUrl(value)).toBe(false);
  });
});

describe("httpUrl", () => {
  it("keeps a web url unchanged", () => {
    expect(httpUrl.parse("https://example.org/x")).toBe("https://example.org/x");
  });

  it.each(HOSTILE_URLS)("degrades %j to null instead of failing the parse", (value) => {
    expect(httpUrl.parse(value)).toBeNull();
  });

  it("still requires a string", () => {
    expect(httpUrl.safeParse(undefined).success).toBe(false);
  });

  it("degrades one bad entry without rejecting its siblings", () => {
    const links = z.array(z.object({ title: z.string(), url: httpUrl }));
    const parsed = links.parse([
      { title: "Docs", url: "https://docs.example.org" },
      { title: "Evil", url: "javascript:alert(1)" },
      { title: "Blob", url: "data:text/html,x" },
    ]);
    expect(parsed.map((link) => link.url)).toEqual(["https://docs.example.org", null, null]);
  });
});

describe("optionalHttpUrl", () => {
  it("passes null and undefined through", () => {
    const schema = z.object({ url: optionalHttpUrl });
    expect(schema.parse({ url: null }).url).toBeNull();
    expect(schema.parse({}).url).toBeUndefined();
  });

  it.each(HOSTILE_URLS)("degrades %j to null", (value) => {
    expect(optionalHttpUrl.parse(value)).toBeNull();
  });
});

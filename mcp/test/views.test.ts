import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fetchView, ViewUnavailable, viewUrl } from "../src/views.ts";

const BASE = "https://{org}.example.test/data/{org}/views";
const schema = z.object({ value: z.number() });

const respondWith = (body: BodyInit, status = 200): typeof fetch =>
  async () => new Response(body, { status, headers: { "Cache-Control": "no-cache" } });

class MemoryCache {
  readonly stored = new Map<string, Response>();
  async match(request: Request) {
    return this.stored.get(request.url)?.clone();
  }
  async put(request: Request, response: Response) {
    this.stored.set(request.url, response);
  }
}

describe("viewUrl", () => {
  it("replaces every org placeholder", () => {
    expect(viewUrl(BASE, "openedx", "meta")).toBe(
      "https://openedx.example.test/data/openedx/views/meta.json",
    );
  });
});

describe("fetchView", () => {
  it("parses a valid response", async () => {
    const deps = { fetch: respondWith('{"value":3}'), base: BASE };
    await expect(fetchView(deps, "openedx", "meta", schema)).resolves.toEqual({ value: 3 });
  });

  it("stores the response with s-maxage and serves it from cache next time", async () => {
    const cache = new MemoryCache();
    let calls = 0;
    const counting: typeof fetch = async (...args) => {
      calls += 1;
      return respondWith('{"value":1}')(...args);
    };
    const deps = { fetch: counting, base: BASE, cache: cache as unknown as Cache };
    await fetchView(deps, "openedx", "meta", schema);
    await fetchView(deps, "openedx", "meta", schema);
    const stored = [...cache.stored.values()][0];
    expect(stored?.headers.get("Cache-Control")).toBe("s-maxage=300");
    expect(calls).toBe(1);
  });

  it("throws ViewUnavailable naming org and view on non-200", async () => {
    const deps = { fetch: respondWith("nope", 404), base: BASE };
    const failure = fetchView(deps, "moneta", "apps", schema);
    await expect(failure).rejects.toBeInstanceOf(ViewUnavailable);
    await expect(failure).rejects.toThrow(/apps.*moneta|moneta.*apps/);
  });

  it("throws ViewUnavailable on non-JSON", async () => {
    const deps = { fetch: respondWith("<html>"), base: BASE };
    await expect(fetchView(deps, "openedx", "meta", schema)).rejects.toBeInstanceOf(ViewUnavailable);
  });

  it("throws ViewUnavailable on schema failure", async () => {
    const deps = { fetch: respondWith('{"value":"x"}'), base: BASE };
    await expect(fetchView(deps, "openedx", "meta", schema)).rejects.toBeInstanceOf(ViewUnavailable);
  });

  it("throws ViewUnavailable when fetch rejects", async () => {
    const deps = { fetch: (async () => { throw new Error("down"); }) as typeof fetch, base: BASE };
    await expect(fetchView(deps, "openedx", "meta", schema)).rejects.toBeInstanceOf(ViewUnavailable);
  });
});

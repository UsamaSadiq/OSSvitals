import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fetchView, ViewUnavailable, viewUrl } from "../src/views.ts";

const BASE = "https://{org}.example.test/data/{org}/views";
const schema = z.object({ value: z.number() });

const respondWith = (body: BodyInit, status = 200, type = "application/json"): typeof fetch =>
  async () => new Response(body, { status, headers: { "Cache-Control": "no-cache", "Content-Type": type } });

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

  it("treats the site's html fallback as not published and never caches it", async () => {
    const cache = new MemoryCache();
    const deps = { fetch: respondWith("<html>", 200, "text/html"), base: BASE, cache: cache as unknown as Cache };
    await expect(fetchView(deps, "openedx", "meta", schema)).rejects.toThrow(/not published/);
    expect(cache.stored.size).toBe(0);
  });

  it("does not cache a response that fails validation", async () => {
    const cache = new MemoryCache();
    const deps = { fetch: respondWith('{"value":"x"}'), base: BASE, cache: cache as unknown as Cache };
    await expect(fetchView(deps, "openedx", "meta", schema)).rejects.toBeInstanceOf(ViewUnavailable);
    expect(cache.stored.size).toBe(0);
  });

  it("throws ViewUnavailable on schema failure", async () => {
    const deps = { fetch: respondWith('{"value":"x"}'), base: BASE };
    await expect(fetchView(deps, "openedx", "meta", schema)).rejects.toBeInstanceOf(ViewUnavailable);
  });

  it("throws ViewUnavailable when fetch rejects", async () => {
    const deps = { fetch: (async () => { throw new Error("down"); }) as typeof fetch, base: BASE };
    await expect(fetchView(deps, "openedx", "meta", schema)).rejects.toBeInstanceOf(ViewUnavailable);
  });

  it("passes an abort signal to the upstream fetch", async () => {
    let signal: AbortSignal | null | undefined;
    const capturing: typeof fetch = async (input, init) => {
      signal = init?.signal;
      return respondWith('{"value":1}')(input, init);
    };
    await fetchView({ fetch: capturing, base: BASE }, "openedx", "meta", schema);
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects a response whose Content-Length exceeds the cap", async () => {
    const oversized: typeof fetch = async () =>
      new Response('{"value":1}', {
        headers: { "Content-Type": "application/json", "Content-Length": String(6 * 1024 * 1024) },
      });
    await expect(fetchView({ fetch: oversized, base: BASE }, "openedx", "meta", schema)).rejects.toThrow(
      /too large/,
    );
  });

  it("stops reading a streamed body that exceeds the cap without a Content-Length", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(chunk);
      },
    });
    const streaming: typeof fetch = async () =>
      new Response(endless, { headers: { "Content-Type": "application/json" } });
    await expect(fetchView({ fetch: streaming, base: BASE }, "openedx", "meta", schema)).rejects.toThrow(
      /too large/,
    );
    expect(pulled).toBeLessThan(10);
  });

  it("reports a network error when the body read fails", async () => {
    const failing = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("reset"));
      },
    });
    const broken: typeof fetch = async () =>
      new Response(failing, { headers: { "Content-Type": "application/json" } });
    await expect(fetchView({ fetch: broken, base: BASE }, "openedx", "meta", schema)).rejects.toThrow(
      /network error/,
    );
  });
});

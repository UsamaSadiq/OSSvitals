import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { metadata, metaFixture } from "./fixtures";
import { clearViewCache, loadView, viewUrl } from "./load";
import { ViewDataError } from "./parse";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function fetchReturning(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () => jsonResponse(body, status));
}

async function rejectionOf(promise: Promise<unknown>): Promise<ViewDataError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ViewDataError);
  return error as ViewDataError;
}

beforeEach(clearViewCache);

describe("viewUrl", () => {
  it("reads from the data host when the build names one", () => {
    vi.stubEnv("VITE_DATA_BASE", "https://data.ossvitals.org");
    try {
      expect(viewUrl("openedx", "overview")).toBe("https://data.ossvitals.org/openedx/views/overview.json");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("is same-origin under /data/<org>/views", () => {
    expect(viewUrl("openedx", "overview")).toBe("/data/openedx/views/overview.json");
  });
});

describe("loadView", () => {
  it("returns parsed data for a valid file and keeps unknown config keys", async () => {
    const fetchImpl = fetchReturning(metaFixture());
    const meta = await loadView("meta", "openedx", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith("/data/openedx/views/meta.json");
    expect(meta.feature_flags.enable_maintainer_views).toBe(false);
    expect(meta.branding.colors).toEqual({ primary: "#00262B" });
  });

  it("fetches each URL once per session", async () => {
    const fetchImpl = fetchReturning(metaFixture());
    await Promise.all([loadView("meta", "openedx", fetchImpl), loadView("meta", "openedx", fetchImpl)]);
    await loadView("meta", "openedx", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("caches per org", async () => {
    const fetchImpl = fetchReturning(metaFixture());
    await loadView("meta", "openedx", fetchImpl);
    await loadView("meta", "edly", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects a file that does not match its schema, naming the file and field", async () => {
    const broken = { ...metaFixture(), feature_flags: {} };
    const error = await rejectionOf(loadView("meta", "openedx", fetchReturning(broken)));

    expect(error.kind).toBe("schema");
    expect(error.message).toMatch(/^meta\.json: /);
    expect(error.message).toContain("feature_flags.enable_maintainer_views");
  });

  it("rejects a schema_version other than 1", async () => {
    const future = metaFixture({ metadata: metadata("dashboard/config", { schema_version: 2 }) });
    const error = await rejectionOf(loadView("meta", "openedx", fetchReturning(future)));

    expect(error.kind).toBe("schema_version");
    expect(error.message).toBe("meta.json: schema_version 2, expected 1");
  });

  it("rejects a network failure and retries on the next call", async () => {
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    const error = await rejectionOf(loadView("overview", "openedx", offline));

    expect(error.kind).toBe("network");
    expect(error.message).toBe("overview.json: could not be downloaded (Failed to fetch)");

    const online = fetchReturning(metaFixture());
    await loadView("meta", "openedx", online);
    await rejectionOf(loadView("overview", "openedx", online));
    expect(online).toHaveBeenCalledTimes(2);
  });

  it("rejects an HTTP error status", async () => {
    const error = await rejectionOf(loadView("repos", "openedx", fetchReturning({}, 404)));

    expect(error.kind).toBe("http");
    expect(error.message).toBe("repos.json: HTTP 404 from /data/openedx/views/repos.json");
  });

  describe("with a data host", () => {
    const HOST = "https://data.ossvitals.org";
    const urlsOf = (fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>) => fetchImpl.mock.calls.map(([url]) => url);

    beforeEach(() => vi.stubEnv("VITE_DATA_BASE", HOST));
    afterEach(() => vi.unstubAllEnvs());

    it("reads every view from the host once its meta.json checks out, with a deadline on the check", async () => {
      const fetchImpl = fetchReturning(metaFixture());
      await loadView("meta", "openedx", fetchImpl);
      await rejectionOf(loadView("overview", "openedx", fetchImpl));

      expect(urlsOf(fetchImpl)).toEqual([
        `${HOST}/openedx/views/meta.json`,
        `${HOST}/openedx/views/meta.json`,
        `${HOST}/openedx/views/overview.json`,
      ]);
      expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it("switches every view to the bundled copy when the host fails, and warns", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const fetchImpl = vi.fn<typeof fetch>(async (input) =>
        String(input).startsWith(HOST) ? jsonResponse({}, 503) : jsonResponse(metaFixture()),
      );
      const meta = await loadView("meta", "openedx", fetchImpl);
      await rejectionOf(loadView("overview", "openedx", fetchImpl));

      expect(meta.feature_flags.enable_maintainer_views).toBe(false);
      expect(urlsOf(fetchImpl)).toEqual([
        `${HOST}/openedx/views/meta.json`,
        "/data/openedx/views/meta.json",
        "/data/openedx/views/overview.json",
      ]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("HTTP 503"));
      warn.mockRestore();
    });

    it("falls back when the host publishes a schema_version this build does not read", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const future = metaFixture({ metadata: metadata("dashboard/config", { schema_version: 2 }) });
      const fetchImpl = vi.fn<typeof fetch>(async (input) =>
        jsonResponse(String(input).startsWith(HOST) ? future : metaFixture()),
      );
      await loadView("meta", "openedx", fetchImpl);

      expect(urlsOf(fetchImpl).at(-1)).toBe("/data/openedx/views/meta.json");
      warn.mockRestore();
    });
  });

  it("treats an HTML page served with 200 as a missing file", async () => {
    const spaFallback = vi.fn<typeof fetch>(
      async () => new Response("<!doctype html>", { status: 200, headers: { "Content-Type": "text/html" } }),
    );
    const error = await rejectionOf(loadView("meta", "www", spaFallback));

    expect(error.kind).toBe("http");
    expect(error.message).toBe("meta.json: not found at /data/www/views/meta.json (got text/html)");
  });
});

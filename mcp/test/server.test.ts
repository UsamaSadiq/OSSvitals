import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import { handle, type HandlerDeps } from "../src/index.ts";
import { neverLimit } from "../src/limiter.ts";

const BASE = "https://{org}.test/data/{org}/views";

function metaFor(org: string) {
  return {
    metadata: {
      schema_version: 1,
      org,
      generated_at: "2026-09-01T00:00:00+00:00",
      snapshot_timestamp: null,
      source: "test",
    },
    branding: { name: `${org} name`, short_name: org, tagline: `${org} tagline` },
    feature_flags: { enable_maintainer_views: false },
    stale_threshold_hours: 48,
    critically_stale_threshold_hours: 168,
  };
}

const fakeFetch: typeof fetch = async (input) => {
  const url = String(input);
  const org = /^https:\/\/(\w+)\.test\//.exec(url)?.[1];
  if (!org || !url.endsWith("/meta.json")) return new Response("missing", { status: 404 });
  return Response.json(metaFor(org));
};

const deps: HandlerDeps = { fetch: fakeFetch, limiter: neverLimit, base: BASE };
const endpoint = (path: string) => `https://mcp.ossvitals.org${path}`;

async function connect(path: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(endpoint(path)), {
    fetch: (input, init) => handle(new Request(input, init), deps),
  });
  const client = new Client({ name: "test", version: "0" });
  await client.connect(transport);
  return client;
}

describe("mcp worker", () => {
  it("initialises, lists list_tenants and the health tools and returns both tenants", async () => {
    const client = await connect("/openedx/mcp");
    expect(client.getServerVersion()?.name).toBe("ossvitals");
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "list_tenants",
        "get_overview",
        "list_repos",
        "get_repo",
        "get_check",
        "list_needing_attention",
      ]),
    );
    const result = await client.callTool({ name: "list_tenants", arguments: {} });
    const content = result.content as { type: string; text: string }[];
    const listing = JSON.parse(content[0]?.text ?? "[]") as Record<string, unknown>[];
    expect(listing.map((entry) => entry.org)).toEqual(["openedx", "moneta"]);
    expect(listing[0]).toMatchObject({
      kind: "health",
      name: "openedx name",
      endpoint: "https://mcp.ossvitals.org/openedx/mcp",
      generated_at: "2026-09-01T00:00:00+00:00",
    });
    await client.close();
  });

  it("falls back to the org name with an error when meta is unavailable", async () => {
    const failing: HandlerDeps = { ...deps, fetch: async () => new Response("x", { status: 500 }) };
    const transport = new StreamableHTTPClientTransport(new URL(endpoint("/mcp")), {
      fetch: (input, init) => handle(new Request(input, init), failing),
    });
    const client = new Client({ name: "test", version: "0" });
    await client.connect(transport);
    const result = await client.callTool({ name: "list_tenants", arguments: {} });
    const content = result.content as { text: string }[];
    const listing = JSON.parse(content[0]?.text ?? "[]") as Record<string, unknown>[];
    expect(listing[0]).toMatchObject({ org: "openedx", name: "openedx" });
    expect(listing[0]?.error).toContain("meta");
    await client.close();
  });

  it("answers health and 404s for an unknown org", async () => {
    const health = await handle(new Request(endpoint("/healthz")), deps);
    expect(await health.text()).toBe("ok");
    const unknown = await handle(new Request(endpoint("/nope/mcp"), { method: "POST" }), deps);
    expect(unknown.status).toBe(404);
  });

  it("returns 429 with Retry-After when the limiter rejects", async () => {
    const limited: HandlerDeps = { ...deps, limiter: { limit: async () => ({ success: false }) } };
    const response = await handle(new Request(endpoint("/openedx/mcp"), { method: "POST" }), limited);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });
});

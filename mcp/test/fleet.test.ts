import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import appsJson from "./fixtures/moneta/views/apps.json";
import conflictsJson from "./fixtures/moneta/views/conflicts.json";
import driftJson from "./fixtures/moneta/views/drift.json";
import metaJson from "./fixtures/moneta/views/meta.json";
import { handle, type HandlerDeps } from "../src/index.ts";
import { neverLimit } from "../src/limiter.ts";

const BASE = "https://{org}.test/data/{org}/views";

const FIXTURES: Record<string, unknown> = {
  apps: appsJson,
  drift: driftJson,
  conflicts: conflictsJson,
  meta: metaJson,
};

function fakeFetch(unavailable: string[] = []): typeof fetch {
  return async (input) => {
    const view = /\/views\/(\w+)\.json$/.exec(String(input))?.[1];
    const body = view === undefined ? undefined : FIXTURES[view];
    if (!view || body === undefined || unavailable.includes(view)) return new Response("missing", { status: 404 });
    return Response.json(body);
  };
}

async function connect(unavailable: string[] = []): Promise<Client> {
  const deps: HandlerDeps = { fetch: fakeFetch(unavailable), limiter: neverLimit, base: BASE };
  const transport = new StreamableHTTPClientTransport(new URL("https://mcp.ossvitals.org/moneta/mcp"), {
    fetch: (input, init) => handle(new Request(input, init), deps),
  });
  const client = new Client({ name: "test", version: "0" });
  await client.connect(transport);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { text: string }[])[0]?.text ?? "";
  return { isError: result.isError === true, text };
}

describe("moneta fleet tools", () => {
  it("lists list_tenants, report_issue and the three fleet tools", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      ["get_app", "get_conflict_forecast", "list_apps", "list_tenants", "report_issue"].sort(),
    );
    await client.close();
  });

  it("list_apps joins and filters", async () => {
    const client = await connect();
    const all = await call(client, "list_apps", {});
    expect(JSON.parse(all.text)).toHaveLength(5);
    const critical = await call(client, "list_apps", { status: "critical", class: "fork" });
    expect(JSON.parse(critical.text)).toMatchObject([{ repo: "alpha", status: "critical" }]);
    await client.close();
  });

  it("get_app returns the merged record", async () => {
    const client = await connect();
    const { text } = await call(client, "get_app", { repo: "alpha" });
    expect(JSON.parse(text)).toMatchObject({ repo: "alpha", status: "critical", behind_by: 2500 });
    await client.close();
  });

  it("get_app reports an unknown repo as an error", async () => {
    const client = await connect();
    const result = await call(client, "get_app", { repo: "nope" });
    expect(result).toEqual({ isError: true, text: "Unknown app nope for moneta" });
    await client.close();
  });

  it("get_app rejects a malformed repo argument", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "get_app", arguments: { repo: "../etc/passwd" } }).catch(() => null);
    expect(result === null || result.isError === true).toBe(true);
    await client.close();
  });

  it("get_conflict_forecast returns the forecast", async () => {
    const client = await connect();
    const { text } = await call(client, "get_conflict_forecast", { repo: "alpha" });
    expect(JSON.parse(text)).toMatchObject({ repo: "alpha", against_upstream_head: { clean: false } });
    await client.close();
  });

  it("get_conflict_forecast returns an error when the view is unavailable", async () => {
    const client = await connect(["conflicts"]);
    const result = await call(client, "get_conflict_forecast", { repo: "alpha" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("conflicts");
    await client.close();
  });

  it("report_issue returns a prefilled issue link without filing anything", async () => {
    const client = await connect();
    const { text } = await call(client, "report_issue", {
      kind: "data",
      title: "alpha drift looks stale",
      details: "behind_by has not moved in a week",
      repo: "alpha",
    });
    const payload = JSON.parse(text) as { url: string; filed: boolean };
    const params = new URL(payload.url).searchParams;

    expect(payload.filed).toBe(false);
    expect(payload.url.startsWith("https://github.com/UsamaSadiq/OSSvitals/issues/new?")).toBe(true);
    expect(Object.fromEntries(params)).toMatchObject({
      template: "wrong-data.yml",
      tenant: "moneta",
      repo: "alpha",
      data_date: "2026-08-31",
    });
    await client.close();
  });

  it("report_issue returns an error when meta is unavailable", async () => {
    const client = await connect(["meta"]);
    const result = await call(client, "report_issue", { kind: "bug", title: "t", details: "d" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("meta");
    await client.close();
  });
});

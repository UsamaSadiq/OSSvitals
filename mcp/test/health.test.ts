import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import { handle, type HandlerDeps } from "../src/index.ts";
import { neverLimit } from "../src/limiter.ts";
import attention from "./fixtures/openedx/views/attention.json";
import checks from "./fixtures/openedx/views/checks.json";
import overview from "./fixtures/openedx/views/overview.json";
import repos from "./fixtures/openedx/views/repos.json";
import repoDetail from "./fixtures/openedx/views/repo_detail.json";

const BASE = "https://{org}.test/data/{org}/views";
const VIEWS: Record<string, unknown> = { attention, checks, overview, repos, repo_detail: repoDetail };

function fakeFetch(calls: string[] = [], missing: string[] = []): typeof fetch {
  return async (input) => {
    const view = /\/views\/(\w+)\.json$/.exec(String(input))?.[1];
    const body = view && !missing.includes(view) ? VIEWS[view] : undefined;
    if (!view || body === undefined) return new Response("missing", { status: 404 });
    calls.push(view);
    return Response.json(body);
  };
}

async function connect(fetchImpl: typeof fetch = fakeFetch()): Promise<Client> {
  const deps: HandlerDeps = { fetch: fetchImpl, limiter: neverLimit, base: BASE };
  const transport = new StreamableHTTPClientTransport(new URL("https://mcp.ossvitals.org/openedx/mcp"), {
    fetch: (input, init) => handle(new Request(input, init), deps),
  });
  const client = new Client({ name: "test", version: "0" });
  await client.connect(transport);
  return client;
}

interface ToolOutcome {
  isError: boolean;
  text: string;
  json: Record<string, any>;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolOutcome> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { text: string }[];
  const text = content[0]?.text ?? "";
  return { isError: result.isError === true, text, json: result.isError ? {} : JSON.parse(text) };
}

describe("health tools", () => {
  it("registers the five health tools on the tenant endpoint", async () => {
    const client = await connect();
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining(["get_overview", "list_repos", "get_repo", "get_check", "list_needing_attention"]),
    );
    await client.close();
  });

  it("get_overview returns the compact overview", async () => {
    const client = await connect();
    const { json } = await call(client, "get_overview");
    expect(json.kpis.repos).toBe(169);
    expect(json.top_failing).toHaveLength(10);
    expect(json.movers).toHaveProperty("gainers");
    await client.close();
  });

  it("list_repos filters, sorts and paginates", async () => {
    const client = await connect();
    const { json } = await call(client, "list_repos", { sort: "name", page: 1, page_size: 3 });
    expect(json.total).toBe(7);
    expect(json.records).toHaveLength(3);
    const filtered = await call(client, "list_repos", { owner: "sameeramin" });
    expect(filtered.json.records.map((record: { repo_name: string }) => record.repo_name)).toEqual([
      "openedx/license-manager",
    ]);
    await client.close();
  });

  it("list_repos rejects an out-of-range page size", async () => {
    const client = await connect();
    const outcome = await call(client, "list_repos", { page_size: 500 });
    expect(outcome.isError).toBe(true);
    await client.close();
  });

  it("get_repo resolves a bare name with three view fetches", async () => {
    const calls: string[] = [];
    const client = await connect(fakeFetch(calls));
    const { json } = await call(client, "get_repo", { repo: "Credentials" });
    expect(json.repo_name).toBe("openedx/credentials");
    expect(json.failing_checks[0]).toHaveProperty("title");
    expect(new Set(calls)).toEqual(new Set(["repos", "checks", "repo_detail"]));
    expect(json.failing_checks[0]).toHaveProperty("fix_pr", null);
    await client.close();
  });

  it("get_repo still answers when repo_detail is unavailable", async () => {
    const client = await connect(fakeFetch([], ["repo_detail"]));
    const { isError, json } = await call(client, "get_repo", { repo: "credentials" });
    expect(isError).toBe(false);
    expect(json.repo_name).toBe("openedx/credentials");
    expect(json.failing_checks[0]).toHaveProperty("fix_pr", null);
    await client.close();
  });

  it("get_repo reports an unknown repo as a tool error", async () => {
    const client = await connect();
    const outcome = await call(client, "get_repo", { repo: "openedx/nope" });
    expect(outcome.isError).toBe(true);
    expect(outcome.text).toBe("Unknown repo openedx/nope for openedx");
    await client.close();
  });

  it("get_check returns remediation and pr template", async () => {
    const client = await connect();
    const { json } = await call(client, "get_check", { check: "dependabot.exists" });
    expect(json.title).toBe("Dependabot Config");
    expect(json.remediation.title).toBe("Add Dependabot configuration");
    expect(json.pr_template.branch).toBe("chore/dependabot-config");
    await client.close();
  });

  it("get_check lists valid names for an unknown check", async () => {
    const client = await connect();
    const outcome = await call(client, "get_check", { check: "nope" });
    expect(outcome.isError).toBe(true);
    expect(outcome.text).toContain("dependabot.exists");
    expect(outcome.text.split("Valid checks: ")[1]?.split(", ")).toHaveLength(30);
    await client.close();
  });

  it("list_needing_attention paginates attention records", async () => {
    const client = await connect();
    const { json } = await call(client, "list_needing_attention", { page: 1, page_size: 2 });
    expect(json.total).toBe(3);
    expect(json.records).toHaveLength(2);
    expect(json.records[0].reasons).toBe("important tier with 5+ failing checks");
    await client.close();
  });

  it("surfaces an unavailable view as a tool error", async () => {
    const client = await connect(async () => new Response("x", { status: 500 }));
    const outcome = await call(client, "get_overview");
    expect(outcome.isError).toBe(true);
    expect(outcome.text).toContain("overview");
    await client.close();
  });
});

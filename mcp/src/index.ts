import { createMcpHandler } from "@modelcontextprotocol/server";
import { limiterFromBinding, type Limiter } from "./limiter.ts";
import { route } from "./router.ts";
import { buildServer } from "./server.ts";
import { tenantFor, tenantOrgs } from "./tenants.ts";
import type { ViewDeps } from "./views.ts";

const RATE_LIMIT_RETRY_SECONDS = "60";

export interface HandlerDeps {
  fetch: typeof fetch;
  limiter: Limiter;
  base: string;
  cache?: Cache;
}

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function indexText(origin: string): string {
  const endpoints = [`${origin}/mcp`, ...tenantOrgs().map((org) => `${origin}/${org}/mcp`)];
  return ["OSSvitals MCP server (read-only, public data)", "", ...endpoints, ""].join("\n");
}

function clientKey(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

function viewDeps(deps: HandlerDeps): ViewDeps {
  return { fetch: deps.fetch, base: deps.base, cache: deps.cache };
}

async function serveMcp(request: Request, org: string | null, deps: HandlerDeps): Promise<Response> {
  if (org !== null && !tenantFor(org)) return jsonResponse({ error: `Unknown organisation: ${org}` }, 404);
  const handler = createMcpHandler(() => buildServer(org, viewDeps(deps)));
  return handler.fetch(request);
}

export async function handle(request: Request, deps: HandlerDeps): Promise<Response> {
  const url = new URL(request.url);
  const matched = route(url);
  if (matched.kind === "health") return new Response("ok");
  if (matched.kind === "not_found") return jsonResponse({ error: "Not found" }, 404);
  if (matched.kind === "index") return new Response(indexText(url.origin));
  const { success } = await deps.limiter.limit(clientKey(request));
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": RATE_LIMIT_RETRY_SECONDS },
    });
  }
  return serveMcp(request, matched.org, deps);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, {
      fetch: (input, init) => fetch(input, init),
      limiter: limiterFromBinding(env.RATE_LIMITER),
      base: env.VIEWS_BASE,
      cache: caches.default,
    });
  },
};

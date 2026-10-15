export type Route =
  | { kind: "health" }
  | { kind: "index" }
  | { kind: "mcp"; org: string | null }
  | { kind: "not_found" };

const ORG_MCP_PATH = /^\/([^/]+)\/mcp\/?$/;

export function route(url: URL): Route {
  const path = url.pathname;
  if (path === "/healthz") return { kind: "health" };
  if (path === "/") return { kind: "index" };
  if (path === "/mcp" || path === "/mcp/") return { kind: "mcp", org: null };
  const match = ORG_MCP_PATH.exec(path);
  if (match?.[1]) return { kind: "mcp", org: decodeURIComponent(match[1]) };
  return { kind: "not_found" };
}

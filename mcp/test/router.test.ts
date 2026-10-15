import { describe, expect, it } from "vitest";
import { route } from "../src/router.ts";

const routeOf = (path: string) => route(new URL(`https://mcp.ossvitals.org${path}`));

describe("route", () => {
  it("recognises the health and index paths", () => {
    expect(routeOf("/healthz")).toEqual({ kind: "health" });
    expect(routeOf("/")).toEqual({ kind: "index" });
  });

  it("routes the root endpoint with no org", () => {
    expect(routeOf("/mcp")).toEqual({ kind: "mcp", org: null });
  });

  it("routes a tenant endpoint with its org", () => {
    expect(routeOf("/openedx/mcp")).toEqual({ kind: "mcp", org: "openedx" });
  });

  it("returns not_found for anything else", () => {
    expect(routeOf("/openedx")).toEqual({ kind: "not_found" });
    expect(routeOf("/a/b/mcp")).toEqual({ kind: "not_found" });
    expect(routeOf("/mcp/extra")).toEqual({ kind: "not_found" });
  });
});

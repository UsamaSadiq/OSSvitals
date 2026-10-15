import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { metaSchema } from "../../../web/src/data/schemas.ts";
import { tenantFor, tenantOrgs } from "../tenants.ts";
import { fetchView, type ViewDeps } from "../views.ts";

export interface TenantListing {
  org: string;
  kind: string;
  name: string;
  tagline: string | null;
  site: string;
  endpoint: string;
  generated_at: string | null;
  error?: string;
}

export async function describeTenant(deps: ViewDeps, origin: string, org: string): Promise<TenantListing> {
  const tenant = tenantFor(org);
  const base = {
    org,
    kind: tenant?.kind ?? "unknown",
    site: tenant?.site ?? "",
    endpoint: `${origin}/${org}/mcp`,
  };
  try {
    const meta = await fetchView(deps, org, "meta", metaSchema);
    return {
      ...base,
      name: meta.branding.name,
      tagline: meta.branding.tagline,
      generated_at: meta.metadata.generated_at,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return { ...base, name: org, tagline: null, generated_at: null, error: reason };
  }
}

export function registerCommonTools(server: McpServer, deps: ViewDeps, origin: string): void {
  server.registerTool(
    "list_tenants",
    {
      description: "List every organisation this server covers, with its kind, site and MCP endpoint.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const tenants = await Promise.all(tenantOrgs().map((org) => describeTenant(deps, origin, org)));
      return { content: [{ type: "text", text: JSON.stringify(tenants) }] };
    },
  );
}

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { appsSchema, conflictsSchema, driftSchema } from "../../../web/src/kinds/fleet/schemas.ts";
import {
  REPO_PATTERN,
  getApp,
  getConflictForecast,
  listApps,
  unknownAppMessage,
} from "../projections/drift.ts";
import { ViewUnavailable, fetchView, type ViewDeps } from "../views.ts";

const READ_ONLY = { readOnlyHint: true, openWorldHint: false };
const repoInput = z.object({ repo: z.string().regex(REPO_PATTERN) });

function jsonResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

async function guarded(action: () => Promise<ReturnType<typeof jsonResult>>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ViewUnavailable) return errorResult(error.message);
    throw error;
  }
}

export function registerDriftTools(server: McpServer, org: string, deps: ViewDeps): void {
  const loadAppsAndDrift = () =>
    Promise.all([fetchView(deps, org, "apps", appsSchema), fetchView(deps, org, "drift", driftSchema)]);

  server.registerTool(
    "list_apps",
    {
      description:
        "List every app with its drift status against upstream, optionally filtered by status or class (fork or original). Status is judged on the upstream release each fork is built on (release_gap) when one is found, otherwise on commits behind the upstream branch (status_basis).",
      inputSchema: z.object({
        status: z.string().max(40).optional(),
        class: z.enum(["fork", "original"]).optional(),
      }),
      annotations: READ_ONLY,
    },
    ({ status, class: appClass }) =>
      guarded(async () => {
        const [apps, drift] = await loadAppsAndDrift();
        return jsonResult(listApps(apps, drift, { status, class: appClass }));
      }),
  );

  server.registerTool(
    "get_app",
    {
      description: "Get one app's details merged with its drift record, with advisory counts only.",
      inputSchema: repoInput,
      annotations: READ_ONLY,
    },
    ({ repo }) =>
      guarded(async () => {
        const [apps, drift] = await loadAppsAndDrift();
        const app = getApp(apps, drift, repo);
        return app ? jsonResult(app) : errorResult(unknownAppMessage(repo, org));
      }),
  );

  server.registerTool(
    "get_conflict_forecast",
    {
      description: "Get the merge conflict forecast for an app against upstream head and the latest upstream release.",
      inputSchema: repoInput,
      annotations: READ_ONLY,
    },
    ({ repo }) =>
      guarded(async () => {
        const conflicts = await fetchView(deps, org, "conflicts", conflictsSchema);
        const forecast = getConflictForecast(conflicts, repo);
        return forecast ? jsonResult(forecast) : errorResult(unknownAppMessage(repo, org));
      }),
  );
}

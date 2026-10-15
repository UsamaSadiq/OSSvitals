import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { VIEW_SCHEMAS } from "../../../web/src/data/schemas.ts";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  findCheck,
  findRepo,
  listRepos,
  projectAttention,
  projectCheck,
  projectOverview,
  projectRepo,
  validCheckNames,
} from "../projections/health.ts";
import { fetchView, type ViewDeps } from "../views.ts";

const ANNOTATIONS = { readOnlyHint: true, openWorldHint: false };
const GRADES = ["A", "B", "C", "D", "F"] as const;

const pagingShape = {
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

const listReposInput = z.object({
  letter: z.enum(GRADES).optional(),
  tier: z.string().max(50).optional(),
  failing_check: z.string().max(100).optional(),
  owner: z.string().max(120).optional(),
  min_score: z.number().optional(),
  max_score: z.number().optional(),
  sort: z.enum(["score", "name", "last_push"]).default("score"),
  ...pagingShape,
});

const getRepoInput = z.object({ repo: z.string().regex(/^[A-Za-z0-9_.\/-]{1,120}$/) });
const getCheckInput = z.object({ check: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/) });
const pagingInput = z.object(pagingShape);

function jsonResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

export function registerHealthTools(server: McpServer, org: string, deps: ViewDeps): void {
  server.registerTool(
    "get_overview",
    {
      description: "Organisation health overview: KPIs and deltas, grade mix, most failing checks and score movers.",
      inputSchema: z.object({}),
      annotations: ANNOTATIONS,
    },
    async () => jsonResult(projectOverview(await fetchView(deps, org, "overview", VIEW_SCHEMAS.overview))),
  );

  server.registerTool(
    "list_repos",
    {
      description:
        "List repositories with score, letter, tier, failing check count, last push and owner. Filter, sort and paginate.",
      inputSchema: listReposInput,
      annotations: ANNOTATIONS,
    },
    async ({ page, page_size, ...filters }) => {
      const view = await fetchView(deps, org, "repos", VIEW_SCHEMAS.repos);
      return jsonResult(listRepos(view, filters, { page, page_size }));
    },
  );

  server.registerTool(
    "get_repo",
    {
      description:
        "Details for one repository (owner/name or bare name): scores, owners and failing checks with remediation availability.",
      inputSchema: getRepoInput,
      annotations: ANNOTATIONS,
    },
    async ({ repo }) => {
      const repos = await fetchView(deps, org, "repos", VIEW_SCHEMAS.repos);
      const record = findRepo(repos, repo);
      if (!record) return errorResult(`Unknown repo ${repo} for ${org}`);
      const checks = await fetchView(deps, org, "checks", VIEW_SCHEMAS.checks);
      return jsonResult(projectRepo(record, checks));
    },
  );

  server.registerTool(
    "get_check",
    {
      description: "Details for one health check: description, pass rate, remediation guidance and PR template.",
      inputSchema: getCheckInput,
      annotations: ANNOTATIONS,
    },
    async ({ check }) => {
      const view = await fetchView(deps, org, "checks", VIEW_SCHEMAS.checks);
      const record = findCheck(view, check);
      if (!record) return errorResult(`Unknown check ${check} for ${org}. Valid checks: ${validCheckNames(view).join(", ")}`);
      return jsonResult(projectCheck(record));
    },
  );

  server.registerTool(
    "list_needing_attention",
    {
      description: "Repositories flagged as needing attention, with the reasons they were flagged.",
      inputSchema: pagingInput,
      annotations: ANNOTATIONS,
    },
    async (paging) => jsonResult(projectAttention(await fetchView(deps, org, "attention", VIEW_SCHEMAS.attention), paging)),
  );
}

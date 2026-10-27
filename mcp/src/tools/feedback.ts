import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { metaSchema } from "../../../web/src/data/schemas.ts";
import { ISSUE_KINDS, newIssueUrl } from "../../../web/src/feedback/issueUrl.ts";
import { ViewUnavailable, fetchView, type ViewDeps } from "../views.ts";

const NEXT_STEP =
  "Nothing has been filed. Give this link to the user; they review the prefilled issue and submit it on GitHub.";

const reportInput = z.object({
  kind: z.enum(ISSUE_KINDS),
  title: z.string().min(1).max(120),
  details: z.string().min(1).max(1500),
  repo: z.string().max(100).optional(),
  page: z.string().max(300).optional(),
});

function textResult(text: string, isError = false) {
  return { ...(isError && { isError }), content: [{ type: "text" as const, text }] };
}

export function registerFeedbackTools(server: McpServer, org: string, deps: ViewDeps): void {
  server.registerTool(
    "report_issue",
    {
      description:
        "Draft a GitHub issue for the OSSvitals maintainers: a bug (bug), wrong or stale data (data), or a question (question). Returns a prefilled link for the user to review and submit; it does not file anything.",
      inputSchema: reportInput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ kind, title, details, repo, page }) => {
      try {
        const meta = await fetchView(deps, org, "meta", metaSchema);
        const sourceUrl = meta.branding.footer?.source_url;
        if (!sourceUrl) return textResult(`No issue tracker is configured for ${org}`, true);
        const dataDate = meta.metadata.generated_at?.slice(0, 10);
        const url = newIssueUrl(sourceUrl, kind, { tenant: org, title, details, repo, page, dataDate });
        return textResult(JSON.stringify({ url, filed: false, next_step: NEXT_STEP }));
      } catch (error) {
        if (error instanceof ViewUnavailable) return textResult(error.message, true);
        throw error;
      }
    },
  );
}

export const ISSUE_KINDS = ["bug", "data", "question"] as const;

export type IssueKind = (typeof ISSUE_KINDS)[number];

const TEMPLATE_BY_KIND: Record<IssueKind, string> = {
  bug: "bug.yml",
  data: "wrong-data.yml",
  question: "question.yml",
};

export interface IssueContext {
  tenant: string;
  title?: string;
  page?: string;
  repo?: string;
  dataDate?: string;
  details?: string;
}

const FIELD_BY_KEY: Record<Exclude<keyof IssueContext, "title">, string> = {
  tenant: "tenant",
  page: "page",
  repo: "repo",
  dataDate: "data_date",
  details: "details",
};

export function newIssueUrl(sourceUrl: string, kind: IssueKind, context: IssueContext): string {
  const params = new URLSearchParams({ template: TEMPLATE_BY_KIND[kind] });
  if (context.title) params.set("title", context.title);
  for (const [key, field] of Object.entries(FIELD_BY_KEY)) {
    const value = context[key as keyof typeof FIELD_BY_KEY];
    if (value) params.set(field, value);
  }
  return `${sourceUrl.replace(/\/$/, "")}/issues/new?${params}`;
}

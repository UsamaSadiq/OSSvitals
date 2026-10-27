export const ISSUE_KINDS = ["bug", "data", "question"] as const;

export type IssueKind = (typeof ISSUE_KINDS)[number];

const TEMPLATE_BY_KIND: Record<IssueKind, string> = {
  bug: "bug.yml",
  data: "wrong-data.yml",
  question: "question.yml",
};

const TITLE_PREFIX_BY_KIND: Record<IssueKind, string> = {
  bug: "[bug] ",
  data: "[data] ",
  question: "[question] ",
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

function withPrefix(prefix: string, title: string): string {
  return title.startsWith(prefix) ? title : `${prefix}${title}`;
}

export function newIssueUrl(sourceUrl: string, kind: IssueKind, context: IssueContext): string {
  const params = new URLSearchParams({ template: TEMPLATE_BY_KIND[kind] });
  if (context.title) params.set("title", withPrefix(TITLE_PREFIX_BY_KIND[kind], context.title));
  for (const [key, field] of Object.entries(FIELD_BY_KEY)) {
    const value = context[key as keyof typeof FIELD_BY_KEY];
    if (value) params.set(field, value);
  }
  return `${sourceUrl.replace(/\/$/, "")}/issues/new?${params}`;
}

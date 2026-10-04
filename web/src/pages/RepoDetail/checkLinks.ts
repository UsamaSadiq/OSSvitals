export interface PrTemplate {
  branch: string;
  title: string;
  body: string;
}

export function issueTitle(check: string): string {
  return `[Repo health] Fix failing check: ${check}`;
}

export function githubIssueUrl(repo: string, check: string, body: string): string {
  const query = new URLSearchParams({ title: issueTitle(check), body: body.trim() });
  return `https://github.com/${repo}/issues/new?${query.toString()}`;
}

export function githubPrCompareUrl(repo: string, template: PrTemplate): string {
  const query = new URLSearchParams({ quick_pull: "1", title: template.title, body: template.body });
  return `https://github.com/${repo}/compare/main...${template.branch}?${query.toString()}`;
}

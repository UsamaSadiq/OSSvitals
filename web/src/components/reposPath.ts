export const REPOS_PATH = "/repos";

export function reposGradePath(grade: string): string {
  return `${REPOS_PATH}?${new URLSearchParams({ grade }).toString()}`;
}

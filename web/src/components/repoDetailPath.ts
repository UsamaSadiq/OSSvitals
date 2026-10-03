export function repoDetailPath(repo: string): string {
  return `/repo_detail?${new URLSearchParams({ repo }).toString()}`;
}

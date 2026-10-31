import type { FILTER_PARAMS } from "./filters";

type FilterParam = (typeof FILTER_PARAMS)[number];

export const APPS_PATH = "/apps";
export const ATTENTION_PATH = "/attention";

export function appsPath(filters: Partial<Record<FilterParam, string>> = {}): string {
  const query = new URLSearchParams(Object.entries(filters)).toString();
  return query ? `${APPS_PATH}?${query}` : APPS_PATH;
}

export function appPath(repo: string): string {
  return `${APPS_PATH}/${encodeURIComponent(repo)}`;
}

export function compareUrl(githubOrg: string, repo: string, upstream: string, upstreamBranch: string, productionBranch: string): string {
  const owner = upstream.split("/")[0];
  return `https://github.com/${githubOrg}/${repo}/compare/${owner}:${upstreamBranch}...${productionBranch}`;
}

export function releaseUrl(githubOrg: string, repo: string, tag: string): string {
  return `https://github.com/${githubOrg}/${repo}/tree/${encodeURIComponent(tag)}`;
}

export const DATA_BRANCH_BASE = "https://raw.githubusercontent.com/UsamaSadiq/OSSvitals/data";

export function badgeMarkdown(org: string, repo: string): string {
  const endpoint = encodeURIComponent(`${DATA_BRANCH_BASE}/${org}/badges/${repo}.json`);
  return `![upstream sync](https://img.shields.io/endpoint?url=${endpoint})`;
}

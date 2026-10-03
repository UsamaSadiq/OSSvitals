import { parseView, ViewDataError } from "./parse";
import { viewFileName, type View, type ViewName } from "./schemas";

type Fetch = typeof fetch;

const cache = new Map<string, Promise<unknown>>();

export function viewUrl(org: string, name: ViewName): string {
  return `/data/${encodeURIComponent(org)}/views/${viewFileName(name)}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isSpaFallbackPage(response: Response): boolean {
  const contentType = response.headers.get("Content-Type");
  return contentType !== null && !contentType.toLowerCase().includes("json");
}

async function fetchJson(url: string, file: string, fetchImpl: Fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw new ViewDataError(file, "network", `could not be downloaded (${messageOf(error)})`);
  }
  if (!response.ok) throw new ViewDataError(file, "http", `HTTP ${response.status} from ${url}`);
  if (isSpaFallbackPage(response)) {
    throw new ViewDataError(file, "http", `not found at ${url} (got ${response.headers.get("Content-Type")})`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new ViewDataError(file, "json", `is not valid JSON (${messageOf(error)})`);
  }
}

async function fetchView<Name extends ViewName>(name: Name, url: string, fetchImpl: Fetch): Promise<View<Name>> {
  return parseView(name, await fetchJson(url, viewFileName(name), fetchImpl));
}

export function loadView<Name extends ViewName>(
  name: Name,
  org: string,
  fetchImpl: Fetch = fetch,
): Promise<View<Name>> {
  const url = viewUrl(org, name);
  const cached = cache.get(url);
  if (cached) return cached as Promise<View<Name>>;
  const pending = fetchView(name, url, fetchImpl);
  cache.set(url, pending);
  pending.catch(() => cache.delete(url));
  return pending;
}

export function clearViewCache(): void {
  cache.clear();
}

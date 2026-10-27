import { parseView, ViewDataError } from "./parse";
import { viewFileName, type View, type ViewName } from "./schemas";

type Fetch = typeof fetch;

const cache = new Map<string, Promise<unknown>>();
const LOCAL_DATA_BASE = "/data";

export function dataBase(): string {
  return import.meta.env.VITE_DATA_BASE || LOCAL_DATA_BASE;
}

function viewPath(org: string, name: ViewName): string {
  return `${encodeURIComponent(org)}/views/${viewFileName(name)}`;
}

export function viewUrl(org: string, name: ViewName): string {
  return `${dataBase()}/${viewPath(org, name)}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isSpaFallbackPage(response: Response): boolean {
  const contentType = response.headers.get("Content-Type");
  return contentType !== null && !contentType.toLowerCase().includes("json");
}

async function fetchJson(url: string, file: string, fetchImpl: Fetch, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await (signal ? fetchImpl(url, { signal }) : fetchImpl(url));
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

const PRIMARY_TIMEOUT_MS = 5000;
const baseByOrg = new Map<string, Promise<string>>();

async function hostServes(base: string, org: string, fetchImpl: Fetch): Promise<boolean> {
  const url = `${base}/${viewPath(org, "meta")}`;
  try {
    parseView("meta", await fetchJson(url, viewFileName("meta"), fetchImpl, AbortSignal.timeout(PRIMARY_TIMEOUT_MS)));
    return true;
  } catch (error) {
    console.warn(`Data host ${base} failed for ${org}; using the copy bundled with the site. ${messageOf(error)}`);
    return false;
  }
}

// One source per org for the whole session, so every view and the freshness banner (from meta.json)
// describe the same snapshot. The bundled copy is as old as the last code deploy.
export function dataBaseFor(org: string, fetchImpl: Fetch = fetch): Promise<string> {
  const primary = dataBase();
  if (primary === LOCAL_DATA_BASE) return Promise.resolve(primary);
  const cached = baseByOrg.get(org);
  if (cached) return cached;
  const pending = hostServes(primary, org, fetchImpl).then((serves) => (serves ? primary : LOCAL_DATA_BASE));
  baseByOrg.set(org, pending);
  return pending;
}

export async function fetchDataJson(org: string, file: string, fetchImpl: Fetch = fetch): Promise<unknown> {
  const base = await dataBaseFor(org, fetchImpl);
  return fetchJson(`${base}/${encodeURIComponent(org)}/views/${file}`, file, fetchImpl);
}

async function fetchView<Name extends ViewName>(name: Name, org: string, fetchImpl: Fetch): Promise<View<Name>> {
  return parseView(name, await fetchDataJson(org, viewFileName(name), fetchImpl));
}

export function loadView<Name extends ViewName>(
  name: Name,
  org: string,
  fetchImpl: Fetch = fetch,
): Promise<View<Name>> {
  const url = viewUrl(org, name);
  const cached = cache.get(url);
  if (cached) return cached as Promise<View<Name>>;
  const pending = fetchView(name, org, fetchImpl);
  cache.set(url, pending);
  pending.catch(() => cache.delete(url));
  return pending;
}

export function clearViewCache(): void {
  cache.clear();
  baseByOrg.clear();
}

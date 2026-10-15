import type { z } from "zod";

const CACHE_TTL_SECONDS = 300;

export class ViewUnavailable extends Error {
  constructor(org: string, view: string, reason: string) {
    super(`View ${view} for ${org} is unavailable: ${reason}`);
    this.name = "ViewUnavailable";
  }
}

export interface ViewDeps {
  fetch: typeof fetch;
  base: string;
  cache?: Cache;
}

export function viewUrl(base: string, org: string, name: string): string {
  return `${base.replaceAll("{org}", org)}/${name}.json`;
}

function cacheableCopy(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `s-maxage=${CACHE_TTL_SECONDS}`);
  return new Response(response.body, { status: response.status, headers });
}

async function loadResponse(deps: ViewDeps, url: string): Promise<Response> {
  const cacheKey = new Request(url);
  const cached = await deps.cache?.match(cacheKey);
  if (cached) return cached;
  const fresh = await deps.fetch(url);
  if (fresh.status === 200 && deps.cache) {
    await deps.cache.put(cacheKey, cacheableCopy(fresh.clone()));
  }
  return fresh;
}

async function readJson(org: string, name: string, response: Response): Promise<unknown> {
  if (response.status !== 200) throw new ViewUnavailable(org, name, `HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new ViewUnavailable(org, name, "response is not valid JSON");
  }
}

export async function fetchView<Schema extends z.ZodType>(
  deps: ViewDeps,
  org: string,
  name: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const url = viewUrl(deps.base, org, name);
  const response = await loadResponse(deps, url).catch(() => {
    throw new ViewUnavailable(org, name, "network error");
  });
  const parsed = schema.safeParse(await readJson(org, name, response));
  if (!parsed.success) throw new ViewUnavailable(org, name, "does not match the expected shape");
  return parsed.data;
}

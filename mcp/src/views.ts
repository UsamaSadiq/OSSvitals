import type { z } from "zod";

const CACHE_TTL_SECONDS = 300;

export class ViewUnavailable extends Error {
  readonly missing: boolean;

  constructor(org: string, view: string, reason: string) {
    super(`View ${view} for ${org} is unavailable: ${reason}`);
    this.name = "ViewUnavailable";
    this.missing = reason === "HTTP 404" || reason === "not published";
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

function cacheableJson(text: string): Response {
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": `s-maxage=${CACHE_TTL_SECONDS}` },
  });
}

function isJsonContentType(response: Response): boolean {
  return (response.headers.get("Content-Type") ?? "").includes("json");
}

async function fetchJsonText(deps: ViewDeps, org: string, name: string, url: string): Promise<string> {
  const response = await deps.fetch(url).catch(() => {
    throw new ViewUnavailable(org, name, "network error");
  });
  if (response.status !== 200) throw new ViewUnavailable(org, name, `HTTP ${response.status}`);
  if (!isJsonContentType(response)) throw new ViewUnavailable(org, name, "not published");
  return response.text();
}

function parseJson(org: string, name: string, text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ViewUnavailable(org, name, "response is not valid JSON");
  }
}

function validate<Schema extends z.ZodType>(org: string, name: string, schema: Schema, data: unknown): z.infer<Schema> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ViewUnavailable(org, name, "does not match the expected shape");
  return parsed.data;
}

export async function fetchView<Schema extends z.ZodType>(
  deps: ViewDeps,
  org: string,
  name: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const url = viewUrl(deps.base, org, name);
  const cacheKey = new Request(url);
  const cached = await deps.cache?.match(cacheKey);
  if (cached) return validate(org, name, schema, parseJson(org, name, await cached.text()));
  const text = await fetchJsonText(deps, org, name, url);
  const view = validate(org, name, schema, parseJson(org, name, text));
  await deps.cache?.put(cacheKey, cacheableJson(text));
  return view;
}

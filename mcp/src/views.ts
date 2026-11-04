import type { z } from "zod";

const CACHE_TTL_SECONDS = 300;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_VIEW_BYTES = 5 * 1024 * 1024;

export class ViewUnavailable extends Error {
  /** True when the view is not published at all, as opposed to unreachable or malformed. */
  readonly missing: boolean;

  constructor(org: string, view: string, reason: string, missing = false) {
    super(`View ${view} for ${org} is unavailable: ${reason}`);
    this.name = "ViewUnavailable";
    this.missing = missing;
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

function declaredLength(response: Response): number {
  return Number(response.headers.get("Content-Length") ?? 0);
}

async function readCappedText(response: Response, maxBytes: number): Promise<string | null> {
  if (declaredLength(response) > maxBytes) return null;
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

async function fetchJsonText(deps: ViewDeps, org: string, name: string, url: string): Promise<string> {
  const response = await deps.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(() => {
    throw new ViewUnavailable(org, name, "network error");
  });
  if (response.status !== 200) throw new ViewUnavailable(org, name, `HTTP ${response.status}`, response.status === 404);
  if (!isJsonContentType(response)) throw new ViewUnavailable(org, name, "not published", true);
  const text = await readCappedText(response, MAX_VIEW_BYTES).catch(() => {
    throw new ViewUnavailable(org, name, "network error");
  });
  if (text === null) throw new ViewUnavailable(org, name, "response too large");
  return text;
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

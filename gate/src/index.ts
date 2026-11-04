import { accessKeys, emailDomainAllowed, KeySetUnavailableError, verifiedEmail, type AccessCheck } from "./access.ts";
import { DATA_PREFIX, dataKey, serveObject } from "./data.ts";
import { TENANTS, type PrivateTenant, type TenantsByHost } from "./tenants.ts";

export interface GateEnv {
  ASSETS: Fetcher;
  DATA: R2Bucket;
  ACCESS_TEAM_DOMAIN?: string;
  [audience: `ACCESS_AUD_${string}`]: string | undefined;
}

export interface GateDeps {
  tenants: TenantsByHost;
  keysFor: (teamDomain: string) => AccessCheck["keys"];
}

// The site's own CSP without the public data host: a private tenant reads its data from this origin only.
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://cloudflareinsights.com; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-Robots-Tag": "noindex, nofollow",
};

const REVALIDATE = "private, no-cache";
const IMMUTABLE = "private, max-age=31536000, immutable";
const HASHED_ASSET = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/;

export function cacheControlFor(pathname: string, status: number): string {
  return status === 200 && HASHED_ASSET.test(pathname) ? IMMUTABLE : REVALIDATE;
}

export function audienceVar(org: string): `ACCESS_AUD_${string}` {
  return `ACCESS_AUD_${org.toUpperCase().replaceAll("-", "_")}`;
}

function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function withSecurityHeaders(response: Response, pathname: string): Response {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
  secured.headers.set("Cache-Control", cacheControlFor(pathname, response.status));
  return secured;
}

async function guardedRoute(request: Request, env: GateEnv, deps: GateDeps): Promise<Response> {
  try {
    return await route(request, env, deps);
  } catch (error) {
    if (error instanceof KeySetUnavailableError) return text("Sign-in is temporarily unavailable", 503);
    console.error("Unhandled gate error", error);
    return text("Internal error", 500);
  }
}

function accessCheck(env: GateEnv, tenant: PrivateTenant, deps: GateDeps): AccessCheck | null {
  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const audience = env[audienceVar(tenant.org)];
  if (!teamDomain || !audience) return null;
  return { issuer: teamDomain, audience, keys: deps.keysFor(teamDomain) };
}

async function serveData(request: Request, env: GateEnv, tenant: PrivateTenant, pathname: string): Promise<Response> {
  const target = dataKey(pathname, tenant.org);
  if (target.kind === "forbidden") return text("Forbidden", 403);
  if (target.kind === "not_found") return text("Not found", 404);
  return serveObject(env.DATA, target.key, request);
}

async function route(request: Request, env: GateEnv, deps: GateDeps): Promise<Response> {
  const url = new URL(request.url);
  const tenant = deps.tenants.get(url.hostname);
  if (!tenant) return text("Not found", 404);
  const check = accessCheck(env, tenant, deps);
  if (!check) return text("Sign-in is not configured for this site", 503);
  const email = await verifiedEmail(request, check);
  if (!email) return text("Sign in through Cloudflare Access to view this site", 401);
  if (!emailDomainAllowed(email, tenant.emailDomains)) return text("Your account does not have access to this site", 403);
  if (url.pathname.startsWith(DATA_PREFIX)) return serveData(request, env, tenant, url.pathname);
  return env.ASSETS.fetch(request);
}

export async function handle(request: Request, env: GateEnv, deps: GateDeps): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") return withSecurityHeaders(text("Method not allowed", 405), pathname);
  return withSecurityHeaders(await guardedRoute(request, env, deps), pathname);
}

const DEFAULT_DEPS: GateDeps = { tenants: TENANTS, keysFor: accessKeys };

export default {
  fetch: (request: Request, env: GateEnv) => handle(request, env, DEFAULT_DEPS),
} satisfies ExportedHandler<GateEnv>;

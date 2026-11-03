import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { emailDomainAllowed } from "../src/access.ts";
import { dataKey } from "../src/data.ts";
import { audienceVar, handle, type GateDeps, type GateEnv } from "../src/index.ts";
import { privateTenantsByHost } from "../src/tenants.ts";

const TEAM = "https://example-team.cloudflareaccess.com";
const AUD = "edly-aud";
const HOST = "https://edly.ossvitals.org";

const tenants = privateTenantsByHost({
  openedx: { site: "https://openedx.ossvitals.org" },
  edly: { site: HOST, visibility: "private", access: { email_domains: ["arbisoft.com", "edly.io"] } },
  other: { site: "https://other.ossvitals.org", visibility: "private", access: { email_domains: ["other.com"] } },
});

let signingKey: CryptoKey;
let deps: GateDeps;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  signingKey = privateKey;
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  deps = { tenants, keysFor: () => createLocalJWKSet({ keys: [jwk] }) };
});

function token(claims: Record<string, unknown>, { audience = AUD, issuer = TEAM, expires = "1h" } = {}): Promise<string> {
  return new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expires).sign(signingKey);
}

interface FakeObject {
  body: string;
  etag: string;
}

function bucket(objects: Record<string, FakeObject>): R2Bucket {
  return {
    async get(key: string, options?: { onlyIf?: Headers }) {
      const object = objects[key];
      if (!object) return null;
      const httpEtag = `"${object.etag}"`;
      if (options?.onlyIf?.get("If-None-Match") === httpEtag) return { httpEtag };
      return { httpEtag, body: new Response(object.body).body };
    },
  } as unknown as R2Bucket;
}

function env(overrides: Partial<GateEnv> = {}): GateEnv {
  return {
    ASSETS: { fetch: async () => new Response("<html>app</html>", { headers: { "Content-Type": "text/html" } }) } as unknown as Fetcher,
    DATA: bucket({ "edly/views/meta.json": { body: '{"ok":true}', etag: "v1" }, "other/views/meta.json": { body: "{}", etag: "o1" } }),
    ACCESS_TEAM_DOMAIN: TEAM,
    [audienceVar("edly")]: AUD,
    ...overrides,
  };
}

async function get(path: string, headers: Record<string, string> = {}, gateEnv = env(), host = HOST): Promise<Response> {
  return handle(new Request(`${host}${path}`, { headers }), gateEnv, deps);
}

async function signedIn(email: string, options?: Parameters<typeof token>[1]): Promise<Record<string, string>> {
  return { "Cf-Access-Jwt-Assertion": await token({ email }, options) };
}

describe("gate", () => {
  it("serves the app and the host's own data to an allowed, signed-in email", async () => {
    const page = await get("/apps", await signedIn("someone@arbisoft.com"));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("app");
    const data = await get("/data/edly/views/meta.json", await signedIn("Someone@Edly.io"));
    expect(data.status).toBe(200);
    expect(await data.json()).toEqual({ ok: true });
    expect(data.headers.get("ETag")).toBe('"v1"');
  });

  it("answers a revalidation with 304", async () => {
    const response = await get("/data/edly/views/meta.json", { ...(await signedIn("a@arbisoft.com")), "If-None-Match": '"v1"' });
    expect(response.status).toBe(304);
  });

  it("rejects a request without a token, with a forged or expired one, or for another application", async () => {
    expect((await get("/")).status).toBe(401);
    expect((await get("/", { "Cf-Access-Jwt-Assertion": "not-a-jwt" })).status).toBe(401);
    expect((await get("/", await signedIn("a@arbisoft.com", { expires: "-1m" }))).status).toBe(401);
    expect((await get("/", await signedIn("a@arbisoft.com", { audience: "another-app" }))).status).toBe(401);
    expect((await get("/", await signedIn("a@arbisoft.com", { issuer: "https://evil.cloudflareaccess.com" }))).status).toBe(401);
  });

  it("rejects an email outside the tenant's domains, including look-alike subdomains", async () => {
    expect((await get("/", await signedIn("a@gmail.com"))).status).toBe(403);
    expect((await get("/", await signedIn("a@mail.arbisoft.com"))).status).toBe(403);
    expect((await get("/", await signedIn("a@arbisoft.com.evil.io"))).status).toBe(403);
  });

  it("never serves another private tenant's data from this host", async () => {
    const response = await get("/data/other/views/meta.json", await signedIn("a@arbisoft.com"));
    expect(response.status).toBe(403);
  });

  it("serves only view and maintenance JSON from the bucket", async () => {
    const headers = await signedIn("a@arbisoft.com");
    expect((await get("/data/edly/feeds/kev.json", headers)).status).toBe(404);
    expect((await get("/data/edly/views/../../other/views/meta.json", headers)).status).toBe(403);
    expect((await get("/data/edly/views/missing.json", headers)).status).toBe(404);
  });

  it("fails closed when sign-in is not configured for the tenant", async () => {
    const headers = await signedIn("a@arbisoft.com");
    expect((await get("/", headers, env({ ACCESS_TEAM_DOMAIN: undefined }))).status).toBe(503);
    expect((await get("/", headers, env({ [audienceVar("edly")]: undefined }))).status).toBe(503);
  });

  it("serves nothing for a host that is not a private tenant", async () => {
    const response = await get("/", await signedIn("a@arbisoft.com"), env(), "https://openedx.ossvitals.org");
    expect(response.status).toBe(404);
  });

  it("marks every response private and unindexed, and rejects writes", async () => {
    const response = await get("/", await signedIn("a@arbisoft.com"));
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(response.headers.get("Content-Security-Policy")).not.toContain("data.ossvitals.org");
    const post = await handle(new Request(HOST, { method: "POST" }), env(), deps);
    expect(post.status).toBe(405);
  });
});

describe("dataKey", () => {
  it("maps a data path to the org's key", () => {
    expect(dataKey("/data/edly/maintenance/summary.json", "edly")).toEqual({ kind: "key", key: "edly/maintenance/summary.json" });
  });
});

describe("emailDomainAllowed", () => {
  it("matches the exact domain after the last @", () => {
    expect(emailDomainAllowed("a@edly.io", ["edly.io"])).toBe(true);
    expect(emailDomainAllowed("a@x.edly.io", ["edly.io"])).toBe(false);
    expect(emailDomainAllowed("edly.io", ["edly.io"])).toBe(false);
  });
});

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

export interface AccessCheck {
  readonly issuer: string;
  readonly audience: string;
  readonly keys: JWTVerifyGetKey;
}

const remoteKeySets = new Map<string, JWTVerifyGetKey>();

export function accessKeys(teamDomain: string): JWTVerifyGetKey {
  const cached = remoteKeySets.get(teamDomain);
  if (cached) return cached;
  const keys = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
  remoteKeySets.set(teamDomain, keys);
  return keys;
}

/** The signed-in email when the request carries a valid Access token for this application, otherwise null. */
export async function verifiedEmail(request: Request, check: AccessCheck): Promise<string | null> {
  const token = request.headers.get(ACCESS_JWT_HEADER);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, check.keys, { issuer: check.issuer, audience: check.audience, algorithms: ["RS256"] });
    return typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function emailDomainAllowed(email: string, domains: readonly string[]): boolean {
  const at = email.lastIndexOf("@");
  return at > 0 && domains.includes(email.slice(at + 1));
}

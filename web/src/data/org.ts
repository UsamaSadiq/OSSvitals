export const FALLBACK_ORG = "openedx";

const ROOT_DOMAIN = "ossvitals.org";
const ORG_ALIASES: Record<string, string> = { next: "openedx" };

function subdomainOf(hostname: string): string | null {
  const host = hostname.toLowerCase();
  const suffix = `.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const label = host.slice(0, -suffix.length);
  return label && !label.includes(".") ? label : null;
}

export function resolveOrg(hostname: string, defaultOrg: string = FALLBACK_ORG): string {
  const subdomain = subdomainOf(hostname);
  if (!subdomain) return defaultOrg;
  return ORG_ALIASES[subdomain] ?? subdomain;
}

export function currentOrg(): string {
  return resolveOrg(window.location.hostname, import.meta.env.VITE_DEFAULT_ORG || FALLBACK_ORG);
}

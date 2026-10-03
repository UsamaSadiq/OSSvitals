export function shouldNoindex(hostname: string): boolean {
  return hostname.startsWith("next.");
}

export function NoindexMeta({ hostname = window.location.hostname }: { hostname?: string }) {
  return shouldNoindex(hostname) ? <meta name="robots" content="noindex" /> : null;
}

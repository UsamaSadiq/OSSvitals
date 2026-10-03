export const DEFAULT_LEGACY_URL = "https://openedx-health-dashboard.streamlit.app";

export function legacyBaseUrl(configured: string | undefined): string {
  const base = configured?.trim() || DEFAULT_LEGACY_URL;
  return base.replace(/\/+$/, "");
}

export function legacyPageUrl(base: string, pathname: string, search: string): string {
  return `${base}${pathname}${search}`;
}

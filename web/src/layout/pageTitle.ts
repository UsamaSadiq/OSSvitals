import { useEffect } from "react";

export const SITE_TITLE = "Open edX Repo Health";

export function formatPageTitle(page: string): string {
  return `${page} · ${SITE_TITLE}`;
}

export function usePageTitle(page: string): void {
  useEffect(() => {
    document.title = formatPageTitle(page);
  }, [page]);
}

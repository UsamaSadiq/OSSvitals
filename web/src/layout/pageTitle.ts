import { useEffect } from "react";
import { useSiteMeta } from "./siteMeta";

export function formatPageTitle(page: string, siteTitle: string): string {
  return `${page} · ${siteTitle}`;
}

export function usePageTitle(page: string): void {
  const { title } = useSiteMeta();
  useEffect(() => {
    document.title = formatPageTitle(page, title);
  }, [page, title]);
}

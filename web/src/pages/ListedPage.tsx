import type { ReactNode } from "react";
import { useSiteMeta } from "../layout/siteMeta";
import type { PageEntry } from "../tenants/types";
import { isPageVisible } from "./catalog";
import { NotFound } from "./NotFound";

/** A page the nav would hide (maintainer-only with maintainer views off, or left out of the org's page list) is not found. */
export function ListedPage({ page, children }: { page: PageEntry; children: ReactNode }) {
  const { featureFlags, pages } = useSiteMeta();
  return isPageVisible(page, { maintainerViews: featureFlags.enableMaintainerViews, manifest: pages }) ? children : <NotFound />;
}

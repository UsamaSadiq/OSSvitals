import type { ReactNode } from "react";
import { useSiteMeta } from "../layout/siteMeta";
import { NotFound } from "./NotFound";

export function MaintainerOnly({ children }: { children: ReactNode }) {
  const { featureFlags } = useSiteMeta();
  return featureFlags.enableMaintainerViews ? children : <NotFound />;
}

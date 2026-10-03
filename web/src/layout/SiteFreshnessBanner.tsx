import { FreshnessBanner } from "./FreshnessBanner";
import { useSiteMeta } from "./siteMeta";

export function SiteFreshnessBanner() {
  const { freshness } = useSiteMeta();
  return freshness ? <FreshnessBanner {...freshness} /> : null;
}

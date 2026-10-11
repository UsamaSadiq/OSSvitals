import type { ComponentType } from "react";
import { CountBadge } from "../../layout/NavCount";
import { FAILING_JOBS, REPOSITORIES } from "../../layout/navCounts";
import { useAtRiskCount, useAttentionCount, useFailingUpgradeCount } from "../../layout/usePageCounts";

function AttentionCount() {
  return <CountBadge count={useAttentionCount()} noun={REPOSITORIES} />;
}

function AtRiskCount() {
  return <CountBadge count={useAtRiskCount()} noun={REPOSITORIES} />;
}

function UpgradesCount() {
  return <CountBadge count={useFailingUpgradeCount()} noun={FAILING_JOBS} />;
}

export const OPENEDX_NAV_COUNTS: Record<string, ComponentType> = {
  "/needing_attention": AttentionCount,
  "/at_risk": AtRiskCount,
  "/maintenance": UpgradesCount,
};

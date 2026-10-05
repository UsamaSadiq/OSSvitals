import type { ComponentType } from "react";
import { countText, FAILING_JOBS, REPOSITORIES, type CountNoun } from "./navCounts";
import { useAfterFirstPaint } from "./useAfterFirstPaint";
import { useAtRiskCount, useAttentionCount, useFailingUpgradeCount } from "./usePageCounts";

export function CountBadge({ count, noun }: { count: number | null; noun: CountNoun }) {
  if (count === null || count === 0) return null;
  return (
    <>
      <span className="nav__count" aria-hidden="true">
        {count}
      </span>
      <span className="visually-hidden">, {countText(count, noun)}</span>
    </>
  );
}

function AttentionCount() {
  return <CountBadge count={useAttentionCount()} noun={REPOSITORIES} />;
}

function AtRiskCount() {
  return <CountBadge count={useAtRiskCount()} noun={REPOSITORIES} />;
}

function UpgradesCount() {
  return <CountBadge count={useFailingUpgradeCount()} noun={FAILING_JOBS} />;
}

const PAGE_COUNTS: Record<string, ComponentType> = {
  "/needing_attention": AttentionCount,
  "/at_risk": AtRiskCount,
  "/maintenance": UpgradesCount,
};

export function NavCount({ path }: { path: string }) {
  const painted = useAfterFirstPaint();
  const Count = PAGE_COUNTS[path];
  if (!Count || !painted) return null;
  return <Count />;
}

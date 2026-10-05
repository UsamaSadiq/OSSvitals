import type { ComponentType } from "react";
import { useView } from "../data/useView";
import { shownAtRiskCount } from "../pages/AtRisk/atRiskDefaults";
import { attentionCount, countText, failingUpgradeCount, FAILING_JOBS, REPOSITORIES, type CountNoun } from "./navCounts";
import { useAfterFirstPaint } from "./useAfterFirstPaint";

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
  const attention = useView("attention");
  return <CountBadge count={attention.data ? attentionCount(attention.data) : null} noun={REPOSITORIES} />;
}

function AtRiskCount() {
  const atRisk = useView("at_risk");
  return <CountBadge count={atRisk.data ? shownAtRiskCount(atRisk.data) : null} noun={REPOSITORIES} />;
}

function UpgradesCount() {
  const upgrades = useView("upgrades");
  return <CountBadge count={upgrades.data ? failingUpgradeCount(upgrades.data) : null} noun={FAILING_JOBS} />;
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

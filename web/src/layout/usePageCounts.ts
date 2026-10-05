import type { View, ViewName } from "../data/schemas";
import { useView } from "../data/useView";
import { shownAtRiskCount } from "../pages/AtRisk/atRiskDefaults";
import { attentionCount, catalogProblemCount, failingUpgradeCount } from "./navCounts";

function useCount<Name extends ViewName>(name: Name, count: (view: View<Name>) => number | null): number | null {
  const state = useView(name);
  return state.data ? count(state.data) : null;
}

export function useAttentionCount(): number | null {
  return useCount("attention", attentionCount);
}

export function useAtRiskCount(): number | null {
  return useCount("at_risk", shownAtRiskCount);
}

export function useFailingUpgradeCount(): number | null {
  return useCount("upgrades", failingUpgradeCount);
}

export function useCatalogProblemCount(): number | null {
  return useCount("components", catalogProblemCount);
}

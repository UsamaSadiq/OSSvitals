import { useId } from "react";
import { Link } from "react-router";
import { formatNumber } from "../../format";
import { countText, FAILING_JOBS, REPOSITORIES, type CountNoun } from "../../layout/navCounts";
import { PageIcon } from "../../layout/navIcons";
import { useSiteMeta } from "../../layout/siteMeta";
import {
  useAtRiskCount,
  useAttentionCount,
  useCatalogProblemCount,
  useFailingUpgradeCount,
} from "../../layout/usePageCounts";

export interface TriageItem {
  path: string;
  title: string;
  description: string;
  noun: CountNoun;
}

export const TRIAGE_ITEMS = {
  attention: {
    path: "/needing_attention",
    title: "Needing attention",
    description: "Repositories the attention rules flag for action.",
    noun: REPOSITORIES,
  },
  atRisk: {
    path: "/at_risk",
    title: "At risk",
    description: "Production or release repositories with ownership or activity risk.",
    noun: REPOSITORIES,
  },
  upgrades: {
    path: "/maintenance",
    title: "Upgrade jobs failing",
    description: "Requirements upgrade workflows whose latest runs fail.",
    noun: FAILING_JOBS,
  },
  catalog: {
    path: "/components",
    title: "Catalog problems",
    description: "Repositories whose catalog-info.yaml has a problem to fix.",
    noun: REPOSITORIES,
  },
} satisfies Record<string, TriageItem>;

export function triageLabel(item: TriageItem, count: number): string {
  return `${item.title}: ${countText(count, item.noun)}`;
}

function TriageCard({ item, count }: { item: TriageItem; count: number | null }) {
  const descriptionId = useId();
  if (count === null) return null;
  return (
    <li>
      <Link className="triage-card" to={item.path} aria-label={triageLabel(item, count)} aria-describedby={descriptionId}>
        <span className="triage-card__head">
          <PageIcon path={item.path} className="triage-card__icon" />
          <span className="triage-card__title">{item.title}</span>
        </span>
        <span className="triage-card__count">{formatNumber(count)}</span>
        <span className="triage-card__description" id={descriptionId}>
          {item.description}
        </span>
      </Link>
    </li>
  );
}

function AttentionCard() {
  return <TriageCard item={TRIAGE_ITEMS.attention} count={useAttentionCount()} />;
}

function AtRiskCard() {
  return <TriageCard item={TRIAGE_ITEMS.atRisk} count={useAtRiskCount()} />;
}

function UpgradesCard() {
  return <TriageCard item={TRIAGE_ITEMS.upgrades} count={useFailingUpgradeCount()} />;
}

function CatalogCard() {
  return <TriageCard item={TRIAGE_ITEMS.catalog} count={useCatalogProblemCount()} />;
}

export function TriageCards() {
  const { featureFlags } = useSiteMeta();
  return (
    <section className="overview-section triage" aria-label="Triage">
      <ul className="triage-grid">
        <AttentionCard />
        {featureFlags.enableMaintainerViews && <AtRiskCard />}
        <UpgradesCard />
        <CatalogCard />
      </ul>
    </section>
  );
}

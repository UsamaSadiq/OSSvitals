import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { Tabs, type TabItem } from "../../components/Tabs";
import type { UpgradesView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import { CampaignTab } from "./CampaignTab";
import { RedundantPrsTab } from "./RedundantPrs";
import { UpgradeJobsTab } from "./UpgradeJobs";
import { INTRO, NOTHING_TRACKED_BODY, NOTHING_TRACKED_TITLE } from "./upgradesText";
import { WaveTab } from "./WaveTab";
import "./upgrades.css";

function hasNoRedundantPrs(upgrades: UpgradesView): boolean {
  const redundant = upgrades.redundant_prs;
  return redundant?.redundant === 0 && redundant.records.length === 0;
}

/** Views built before the list existed collected everything. */
function collects(upgrades: UpgradesView, collector: string): boolean {
  return upgrades.collectors?.includes(collector) ?? true;
}

function upgradeTabs(upgrades: UpgradesView): TabItem[] {
  return [
    ...(collects(upgrades, "upgrade_jobs")
      ? [{ id: "upgrade-jobs", label: "Upgrade jobs", content: () => <UpgradeJobsTab jobs={upgrades.upgrade_jobs} /> }]
      : []),
    ...upgrades.waves.map((wave) => ({
      id: `wave-${wave.id}`,
      label: `Wave: ${wave.title}`,
      content: () => <WaveTab wave={wave} />,
    })),
    ...(upgrades.campaigns ?? []).map((campaign) => ({
      id: `campaign-${campaign.id}`,
      label: `Campaign: ${campaign.title}`,
      content: () => <CampaignTab campaign={campaign} />,
    })),
    ...(!collects(upgrades, "redundant_prs") || hasNoRedundantPrs(upgrades)
      ? []
      : [
          {
            id: "redundant-prs",
            label: "Redundant PRs",
            content: () => <RedundantPrsTab redundant={upgrades.redundant_prs} />,
          },
        ]),
  ];
}

function UpgradesContent() {
  const upgrades = useView("upgrades");
  if (upgrades.status === "loading") return <Loading label="Loading upgrades…" />;
  if (upgrades.status === "error") {
    return <ErrorState title="The upgrades data could not be loaded." detail={upgrades.error.message} />;
  }
  const tabs = upgradeTabs(upgrades.data);
  if (tabs.length === 0) return <EmptyState kind="info" title={NOTHING_TRACKED_TITLE} body={NOTHING_TRACKED_BODY} />;
  return (
    <>
      <Tabs label="Upgrades" tabs={tabs} />
    </>
  );
}

export function Upgrades() {
  usePageTitle("Upgrades");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">Upgrades</h1>
      <SiteFreshnessBanner />
      <p className="page-lede">{INTRO}</p>
      <UpgradesContent />
    </section>
  );
}

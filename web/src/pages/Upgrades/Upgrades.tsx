import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { ShareLink } from "../../components/ShareLink";
import { Tabs, type TabItem } from "../../components/Tabs";
import type { UpgradesView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import { RedundantPrsTab } from "./RedundantPrs";
import { UpgradeJobsTab } from "./UpgradeJobs";
import { INTRO } from "./upgradesText";
import { WaveTab } from "./WaveTab";
import "./upgrades.css";

function upgradeTabs(upgrades: UpgradesView): TabItem[] {
  return [
    { id: "upgrade-jobs", label: "Upgrade jobs", content: () => <UpgradeJobsTab jobs={upgrades.upgrade_jobs} /> },
    ...upgrades.waves.map((wave) => ({
      id: `wave-${wave.id}`,
      label: `Wave: ${wave.title}`,
      content: () => <WaveTab wave={wave} />,
    })),
    {
      id: "redundant-prs",
      label: "Redundant PRs",
      content: () => <RedundantPrsTab redundant={upgrades.redundant_prs} />,
    },
  ];
}

function UpgradesContent() {
  const upgrades = useView("upgrades");
  if (upgrades.status === "loading") return <Loading label="Loading upgrades…" />;
  if (upgrades.status === "error") {
    return <ErrorState title="The upgrades data could not be loaded." detail={upgrades.error.message} />;
  }
  return (
    <>
      <Tabs label="Upgrades" tabs={upgradeTabs(upgrades.data)} />
      <ShareLink />
    </>
  );
}

export function Upgrades() {
  usePageTitle("Upgrades");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">Upgrades</h1>
      <SiteFreshnessBanner />
      <p className="caption">{INTRO}</p>
      <UpgradesContent />
    </section>
  );
}

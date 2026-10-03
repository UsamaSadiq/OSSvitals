import { CodeText } from "../../components/CodeText";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { KpiTile } from "../../components/KpiTile";
import { Loading } from "../../components/Loading";
import { ShareLink } from "../../components/ShareLink";
import { Tabs, type TabItem } from "../../components/Tabs";
import type { OwnersView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import { MyRepos } from "./MyRepos";
import { OwnerPanel } from "./OwnerPanel";
import { GroupTable, OwnerSummaryTable } from "./OwnerTables";
import {
  COVERAGE_CAPTION,
  LOW_COVERAGE_PERCENT,
  LOW_COVERAGE_WARNING,
  pythonFloat,
  type GroupName,
} from "./ownerText";
import "./owners.css";

function Coverage({ coverage }: { coverage: number }) {
  return (
    <>
      <div className="owners-coverage">
        <KpiTile label="Ownership Coverage" value={`${pythonFloat(coverage)}%`} />
      </div>
      <p className="caption">
        <CodeText text={COVERAGE_CAPTION} />
      </p>
      {coverage < LOW_COVERAGE_PERCENT && (
        <div className="banner banner--warn" role="status">
          <CodeText text={LOW_COVERAGE_WARNING} />
        </div>
      )}
    </>
  );
}

function ByOwner({ owners }: { owners: OwnersView }) {
  if (!owners.has_owner_data) {
    return (
      <EmptyState
        kind="info"
        title="No owner data in this snapshot."
        body={
          <CodeText text="A repository appears here once its `catalog-info.yaml` sets `spec.owner` (OEP-55). None currently do." />
        }
      />
    );
  }
  return (
    <>
      <p className="caption">Select a row to explore that owner's repositories.</p>
      <OwnerSummaryTable rows={owners.records} />
      <OwnerPanel owners={owners} />
    </>
  );
}

const GROUP_TABS: { group: GroupName; label: string }[] = [
  { group: "theme", label: "By Theme" },
  { group: "squad", label: "By Squad" },
];

function groupTabs(owners: OwnersView): TabItem[] {
  return GROUP_TABS.flatMap(({ group, label }) => {
    const rows = owners.groups[group];
    return rows ? [{ id: group, label, content: () => <GroupTable group={group} rows={rows} /> }] : [];
  });
}

function ownerTabs(owners: OwnersView): TabItem[] {
  return [
    { id: "owner", label: "By Owner", content: () => <ByOwner owners={owners} /> },
    ...groupTabs(owners),
    { id: "mine", label: "My Repos", content: () => <MyRepos /> },
  ];
}

function OwnersContent() {
  const owners = useView("owners");
  if (owners.status === "loading") return <Loading label="Loading owners…" />;
  if (owners.status === "error") {
    return <ErrorState title="The owner data could not be loaded." detail={owners.error.message} />;
  }
  return (
    <>
      <Coverage coverage={owners.data.coverage} />
      <Tabs label="Ownership views" tabs={ownerTabs(owners.data)} />
      <ShareLink label="Copy link to this view" />
    </>
  );
}

export function Owners() {
  usePageTitle("Owners");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">Owners</h1>
      <SiteFreshnessBanner />
      <OwnersContent />
    </section>
  );
}

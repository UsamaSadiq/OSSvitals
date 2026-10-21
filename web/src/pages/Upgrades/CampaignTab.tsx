import { CodeText } from "../../components/CodeText";
import { DataTable, type Column } from "../../components/DataTable";
import { RepoName } from "../../components/RepoName";
import type { UpgradesView } from "../../data/schemas";
import { formatNumber } from "../../format";
import { MissingData } from "./MissingData";
import { PullLink } from "./PullLink";
import { exposureText, waveCaption } from "./upgradesText";
import { WaveProgress, WaveTiles } from "./WaveTab";

type Campaign = NonNullable<UpgradesView["campaigns"]>[number];
type CampaignRow = NonNullable<Campaign["records"]>[number];

const repoColumn: Column<CampaignRow> = {
  key: "repo_name",
  header: "Repository",
  cell: (row) => <RepoName name={row.repo_name} />,
  sortValue: (row) => row.repo_name,
};

const exposureColumn: Column<CampaignRow> = {
  key: "runtime_exposed",
  header: "Exposure",
  cell: (row) => exposureText(row.runtime_exposed),
  sortValue: (row) => exposureText(row.runtime_exposed),
};

const OPEN_PR_COLUMNS: Column<CampaignRow>[] = [
  repoColumn,
  {
    key: "pr_age_days",
    header: "Open for (days)",
    cell: (row) => (row.pr_age_days === null || row.pr_age_days === undefined ? "" : formatNumber(row.pr_age_days)),
    sortValue: (row) => row.pr_age_days ?? Number.NEGATIVE_INFINITY,
    numeric: true,
  },
  { key: "pr_url", header: "Upgrade PR", cell: (row) => <PullLink url={row.pr_url} /> },
  exposureColumn,
  { key: "gaps", header: "Pinned below floor", cell: (row) => row.gaps },
];

const NOT_STARTED_COLUMNS: Column<CampaignRow>[] = [
  repoColumn,
  exposureColumn,
  { key: "gaps", header: "Pinned below floor", cell: (row) => row.gaps },
];

function withStatus(records: readonly CampaignRow[], status: string): CampaignRow[] {
  return records.filter((row) => row.status === status);
}

function CampaignHeading({ campaign }: { campaign: Campaign }) {
  return (
    <p>
      <strong>{campaign.title}</strong>
      {campaign.epic && (
        <>
          {" · "}
          <a href={campaign.epic}>tracking issue</a>
        </>
      )}
      {campaign.advisory && (
        <>
          {" · "}
          <a href={campaign.advisory}>advisory</a>
        </>
      )}
    </p>
  );
}

function CampaignTables({ records }: { records: readonly CampaignRow[] }) {
  return (
    <>
      <h2 className="upgrades-section-title">Open upgrade PRs, oldest first</h2>
      <DataTable
        caption="Open upgrade PRs, oldest first"
        captionHidden
        columns={OPEN_PR_COLUMNS}
        rows={withStatus(records, "pr_open")}
        rowKey={(row) => row.repo_name}
        initialSort={{ key: "pr_age_days", direction: "descending" }}
        emptyMessage="No upgrade PRs open."
        maxHeight="380px"
      />
      <h2 className="upgrades-section-title">Not started</h2>
      <DataTable
        caption="Not started"
        captionHidden
        columns={NOT_STARTED_COLUMNS}
        rows={withStatus(records, "not_started")}
        rowKey={(row) => row.repo_name}
        initialSort={{ key: "runtime_exposed", direction: "descending" }}
        emptyMessage="Every repo that pins the package has started."
        maxHeight="380px"
      />
    </>
  );
}

function CampaignSection({ campaign }: { campaign: Campaign }) {
  const summary = campaign.summary ?? {};
  return (
    <>
      <CampaignHeading campaign={campaign} />
      <WaveProgress summary={summary} />
      <WaveTiles summary={summary} />
      <p className="caption">
        <CodeText text={waveCaption(campaign.done_rule, campaign.collected_at)} />
      </p>
      <CampaignTables records={campaign.records ?? []} />
    </>
  );
}

export function CampaignTab({ campaign }: { campaign: Campaign }) {
  return campaign.available ? <CampaignSection campaign={campaign} /> : <MissingData what={`${campaign.title} campaign`} />;
}

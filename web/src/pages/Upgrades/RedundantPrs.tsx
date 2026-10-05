import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { KpiTile } from "../../components/KpiTile";
import type { UpgradesView } from "../../data/schemas";
import { formatNumber } from "../../format";
import { MissingData } from "./MissingData";
import { PullLink } from "./PullLink";
import { mergedText, redundantCaption } from "./upgradesText";
import { RepoName } from "../../components/RepoName";

type Redundant = NonNullable<UpgradesView["redundant_prs"]>;
type RedundantRow = Redundant["records"][number];

const COLUMNS: Column<RedundantRow>[] = [
  { key: "repo_name", header: "Repository", cell: (row) => <RepoName name={row.repo_name} />, sortValue: (row) => row.repo_name },
  { key: "bot_pr_url", header: "Bot PR", cell: (row) => <PullLink url={row.bot_pr_url} /> },
  { key: "superseded_by_url", header: "Superseded by", cell: (row) => <PullLink url={row.superseded_by_url} /> },
  {
    key: "superseded_by_merged",
    header: "Merged",
    cell: (row) => mergedText(row.superseded_by_merged),
    sortValue: (row) => mergedText(row.superseded_by_merged),
  },
  {
    key: "confidence",
    header: "Confidence",
    cell: (row) => row.confidence ?? "",
    sortValue: (row) => row.confidence ?? "",
  },
];

function RedundantTable({ records }: { records: readonly RedundantRow[] }) {
  if (records.length === 0) return <EmptyState kind="good" title="No redundant bot PRs found." />;
  return (
    <DataTable
      caption="Redundant bot PRs"
      captionHidden
      columns={COLUMNS}
      rows={records}
      rowKey={(row) => row.bot_pr_url ?? row.repo_name}
      maxHeight="420px"
    />
  );
}

function RedundantSection({ redundant }: { redundant: Redundant }) {
  return (
    <>
      <p className="caption">{redundantCaption(redundant.collected_at)}</p>
      <div className="upgrades-tiles">
        <KpiTile label="Redundant" value={formatNumber(redundant.redundant)} />
        <KpiTile label="Bot campaign PRs checked" value={formatNumber(redundant.bot_prs_checked)} />
      </div>
      <RedundantTable records={redundant.records} />
    </>
  );
}

export function RedundantPrsTab({ redundant }: { redundant: UpgradesView["redundant_prs"] }) {
  return redundant ? <RedundantSection redundant={redundant} /> : <MissingData what="redundant-PR" />;
}

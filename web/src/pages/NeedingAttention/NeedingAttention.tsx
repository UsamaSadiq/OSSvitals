import { DataTable, type Column } from "../../components/DataTable";
import { DownloadButton } from "../../components/DownloadButton";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { GradePill, GRADE_ORDER } from "../../components/GradePill";
import { Loading } from "../../components/Loading";
import { QuerySelect, useQueryValue } from "../../components/QuerySelect";
import { RepoLink } from "../../components/RepoName";
import { ShareLink } from "../../components/ShareLink";
import { useView } from "../../data/useView";
import { formatScore } from "../../format";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import { ALL_TIERS, attentionCsv, rowsForTier, TIER_OPTIONS, type AttentionRow } from "./attentionRows";

const TIER_PARAM = "tier";

const COLUMNS: Column<AttentionRow>[] = [
  {
    key: "repo",
    header: "Repository",
    cell: (row) => <RepoLink name={row.repo_name} />,
    sortValue: (row) => row.repo_name,
  },
  {
    key: "tier",
    header: "Tier",
    cell: (row) => row.repo_tier,
    sortValue: (row) => row.repo_tier,
  },
  {
    key: "score",
    header: "Score",
    cell: (row) => formatScore(row.score_composite),
    sortValue: (row) => row.score_composite,
    numeric: true,
  },
  {
    key: "grade",
    header: "Grade",
    cell: (row) => <GradePill grade={row.score_letter} />,
    sortValue: (row) => GRADE_ORDER.indexOf(row.score_letter),
  },
  {
    key: "reasons",
    header: "Why flagged",
    cell: (row) => row.reasons,
  },
];

function NothingFlagged() {
  return (
    <EmptyState
      kind="good"
      title="No repositories currently match the attention rules."
      body={
        <>
          Nothing is flagged by the rules in <code>attention_rules.yaml</code> for this tier.
        </>
      }
    />
  );
}

function AttentionList({ rows }: { rows: readonly AttentionRow[] }) {
  if (rows.length === 0) return <NothingFlagged />;
  return (
    <>
      <DataTable
        caption="Repos needing attention"
        captionHidden
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.repo_name}
      />
      <ShareLink label="Copy link to this view" />
      <DownloadButton
        label="Download Attention List"
        filename="needing-attention.csv"
        mimeType="text/csv"
        content={() => attentionCsv(rows)}
      />
    </>
  );
}

function AttentionContent() {
  const attention = useView("attention");
  const tier = useQueryValue(TIER_PARAM, TIER_OPTIONS, ALL_TIERS);
  if (attention.status === "loading") return <Loading label="Loading attention list…" />;
  if (attention.status === "error") {
    return <ErrorState title="The attention data could not be loaded." detail={attention.error.message} />;
  }
  return <AttentionList rows={rowsForTier(attention.data.records, tier)} />;
}

export function NeedingAttention() {
  usePageTitle("Needing Attention");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">Repos Needing Attention</h1>
      <SiteFreshnessBanner />
      <QuerySelect label="Tier filter" param={TIER_PARAM} options={TIER_OPTIONS} defaultValue={ALL_TIERS} />
      <AttentionContent />
    </section>
  );
}

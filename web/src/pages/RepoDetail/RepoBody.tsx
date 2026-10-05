import { useMemo, type ReactNode } from "react";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import type { RepoDetailView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { ActivitySignals } from "./ActivitySignals";
import { CatalogSection } from "./CatalogSection";
import { CategoryCards, type RepoRates } from "./CategoryCards";
import { categoryOptions, checkRows } from "./checkRows";
import { ChecksSection } from "./ChecksSection";
import { MetricBars } from "./MetricBars";
import { rawField, type RepoDetail, type RepoRecord } from "./repoDetailData";
import { RepoHeader } from "./RepoHeader";
import { REPO_SECTIONS, SECTION_IDS, SectionNav } from "./SectionNav";

interface RepoBodyProps {
  repo: string;
  record: RepoRecord;
  detail: RepoDetail;
  detailView: RepoDetailView;
}

function Activity({ record }: { record: RepoRecord }) {
  const meta = useView("meta");
  const overview = useView("overview");
  const error = meta.error ?? overview.error;
  if (error) return <ErrorState title="The activity data could not be loaded." detail={error.message} />;
  if (meta.status !== "ready" || overview.status !== "ready") return <Loading label="Loading activity…" />;
  return (
    <ActivitySignals
      signals={meta.data.signals}
      record={record as Record<string, unknown>}
      unmeasured={overview.data.unmeasured_columns}
    />
  );
}

function useRepoRates(repo: string): RepoRates | null {
  const history = useView("repo_history");
  return useMemo(() => {
    if (history.status !== "ready") return null;
    const byCategory = history.data.repos[repo];
    return byCategory ? { dates: history.data.dates, byCategory } : null;
  }, [history, repo]);
}

function Checks({ repo, record, cardNames }: { repo: string; record: RepoRecord; cardNames: readonly string[] }) {
  const checks = useView("checks");
  const rawValues = useView("repo_checks");
  const error = checks.error ?? rawValues.error;
  if (error) return <ErrorState title="The check data could not be loaded." detail={error.message} />;
  if (checks.status !== "ready" || rawValues.status !== "ready") return <Loading label="Loading checks…" />;
  const rows = checkRows(checks.data.records, rawValues.data.repos[repo] ?? {}, record.checks);
  if (rows.length === 0) return null;
  return <ChecksSection repo={repo} rows={rows} categories={categoryOptions(cardNames, rows)} />;
}

function Anchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="repo-anchor" tabIndex={-1}>
      {children}
    </div>
  );
}

export function RepoBody({ repo, record, detail, detailView }: RepoBodyProps) {
  const rates = useRepoRates(repo);
  return (
    <>
      <SectionNav sections={REPO_SECTIONS} />
      <Anchor id={SECTION_IDS.scores}>
        <RepoHeader repo={repo} record={record} detail={detail} />
        <MetricBars bars={detail.metric_bars} version={rawField(record, "score_config_version")} />
      </Anchor>
      <Anchor id={SECTION_IDS.activity}>
        <Activity record={record} />
      </Anchor>
      <Anchor id={SECTION_IDS.catalog}>
        <CatalogSection
          available={detailView.catalog_available}
          entry={detail.catalog}
          collectedAt={detailView.catalog_collected_at}
        />
      </Anchor>
      <Anchor id={SECTION_IDS.categories}>
        <CategoryCards cards={detail.category_cards} rates={rates} />
      </Anchor>
      <Anchor id={SECTION_IDS.checks}>
        <Checks repo={repo} record={record} cardNames={detail.category_cards.map((card) => card.name)} />
      </Anchor>
    </>
  );
}

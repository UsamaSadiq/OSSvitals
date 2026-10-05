import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { DataTable, type SortState } from "../../components/DataTable";
import { DownloadButton } from "../../components/DownloadButton";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { clampPage, pageCount, pageSlice, Pagination } from "../../components/Pagination";
import { useParamUpdater, type ParamChanges } from "../../components/queryParams";
import { ShareLink } from "../../components/ShareLink";
import type { FailingChecksView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { toCsv } from "../../format/csv";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import { useWatchlist } from "../../watchlist/useWatchlist";
import { byRepoName, CSV_COLUMNS, readSort, REPO_COLUMNS, sortedRepos, sortParams } from "./repoColumns";
import { RepoFacets, type FailingOption } from "./RepoFacets";
import {
  CLEARED_FILTERS,
  facetOptions,
  filterRows,
  hasActiveFilters,
  PARAMS,
  readFilters,
  resultsLine,
  type RepoRow,
} from "./repoFilters";
import "./repos.css";

export const PAGE_SIZE = 50;

function checkNames(rows: readonly RepoRow[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row.checks)))];
}

function failingOptions(failing: FailingChecksView | undefined): FailingOption[] {
  return (failing?.records ?? []).filter((record) => record.failing > 0);
}

function useExplorerOptions(rows: readonly RepoRow[], failing: FailingChecksView | undefined) {
  return useMemo(
    () => ({
      tier: facetOptions(rows, "tier"),
      owner: facetOptions(rows, "owner"),
      lifecycle: facetOptions(rows, "lifecycle"),
      fails: failingOptions(failing),
      knownChecks: checkNames(rows),
    }),
    [rows, failing],
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="repos-empty note note--info" role="status">
      <div className="note__body">
        <strong>No repositories match these filters.</strong>
        <p>Loosen a filter or start again.</p>
        <p>
          <button type="button" className="button-link" onClick={onClear}>
            Clear filters
          </button>
        </p>
      </div>
    </div>
  );
}

function ResultsTable({
  rows,
  sort,
  page,
  onChange,
}: {
  rows: readonly RepoRow[];
  sort: SortState | undefined;
  page: number;
  onChange: (changes: ParamChanges) => void;
}) {
  const count = pageCount(rows.length, PAGE_SIZE);
  const current = clampPage(page, count);
  return (
    <>
      <DataTable
        caption="Repositories"
        captionHidden
        columns={REPO_COLUMNS}
        rows={pageSlice(rows, current, PAGE_SIZE)}
        rowKey={(row) => row.repo_name}
        tieBreak={byRepoName}
        sort={sort}
        onSortChange={(next) => onChange({ ...sortParams(next), [PARAMS.page]: null })}
      />
      <Pagination
        label="Repository pages"
        page={current}
        count={count}
        onPage={(next) => onChange({ [PARAMS.page]: next > 1 ? String(next) : null })}
      />
    </>
  );
}

function Explorer({ rows, failing }: { rows: readonly RepoRow[]; failing: FailingChecksView | undefined }) {
  const [params] = useSearchParams();
  const update = useParamUpdater();
  const watchlist = useWatchlist();
  const options = useExplorerOptions(rows, failing);
  const filters = readFilters(params, { ...options, fails: options.knownChecks });
  const sort = readSort(params, filters.query.trim() !== "");
  const shown = sortedRepos(filterRows(rows, filters, watchlist), sort);
  const changeFilters = (changes: ParamChanges) => update({ ...changes, [PARAMS.page]: null });
  const clear = () => update(CLEARED_FILTERS);
  return (
    <>
      <RepoFacets filters={filters} options={options} onChange={changeFilters} />
      <div className="repos-results-bar">
        <p className="repos-count" role="status">
          {resultsLine(shown.length, rows.length)}
        </p>
        {hasActiveFilters(filters) && shown.length > 0 && (
          <button type="button" className="repos-clear" onClick={clear}>
            Clear filters
          </button>
        )}
        {shown.length > 0 && (
          <DownloadButton
            label="Download CSV"
            filename="repositories.csv"
            mimeType="text/csv"
            content={() => toCsv(CSV_COLUMNS, shown)}
          />
        )}
      </div>
      {shown.length === 0 ? (
        <NoMatches onClear={clear} />
      ) : (
        <ResultsTable rows={shown} sort={sort} page={Number(params.get(PARAMS.page) ?? "1")} onChange={update} />
      )}
    </>
  );
}

function ReposContent() {
  const repos = useView("repos");
  const failing = useView("failing_checks");
  if (repos.status === "loading") return <Loading label="Loading repositories…" />;
  if (repos.status === "error") {
    return <ErrorState title="The repository data could not be loaded." detail={repos.error.message} />;
  }
  return (
    <>
      <Explorer rows={repos.data.records} failing={failing.data} />
      <ShareLink />
    </>
  );
}

export function Repos() {
  usePageTitle("Repositories");
  return (
    <section className="page repos" aria-labelledby="page-title">
      <h1 id="page-title">Repositories</h1>
      <p className="caption">Every scored repository. Filter, sort and share the view: every filter lives in the link.</p>
      <SiteFreshnessBanner />
      <ReposContent />
    </section>
  );
}

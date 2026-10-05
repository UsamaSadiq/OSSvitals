import { useSearchParams } from "react-router";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { KpiTile } from "../../components/KpiTile";
import { Loading } from "../../components/Loading";
import { ShareLink } from "../../components/ShareLink";
import type { ChecksView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { usePageTitle } from "../../layout/pageTitle";
import { Candidates } from "./Candidates";
import { useParamUpdater } from "../../components/queryParams";
import {
  CATALOG_PARAMS,
  countMissingDescriptions,
  countScored,
  filterGroups,
  groupedChecks,
  hasCatalogFilters,
  matchesCatalogFilters,
  readCatalogFilters,
  reviewNames,
  type CheckGroup,
} from "./catalogData";
import { CatalogControls } from "./CatalogControls";
import { CheckEntry } from "./CheckEntry";
import "./checksCatalog.css";
import { UpForReview } from "./UpForReview";

function NoChecks({ checks }: { checks: ChecksView }) {
  return (
    <>
      <EmptyState
        kind="warn"
        title="No check columns detected in this snapshot."
        body="The catalogue below still lists proposed checks."
      />
      <Candidates candidates={checks.candidates} />
    </>
  );
}

function Totals({ records }: { records: ChecksView["records"] }) {
  return (
    <div className="checks-catalog__kpis">
      <KpiTile label="Checks collected" value={records.length} />
      <KpiTile label="Feeding the score" value={countScored(records)} />
      <KpiTile label="Missing descriptions" value={countMissingDescriptions(records)} />
    </div>
  );
}

function GroupSection({ group }: { group: CheckGroup }) {
  return (
    <section className="checks-catalog__section" aria-label={group.name}>
      <h2>{group.name}</h2>
      {group.checks.map((record) => (
        <CheckEntry key={record.check} record={record} />
      ))}
    </section>
  );
}

const CLEARED = Object.fromEntries(Object.values(CATALOG_PARAMS).map((param) => [param, null]));

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="note note--info checks-catalog__empty" role="status">
      <div className="note__body">
        <strong>No checks match these filters.</strong>
        <p>
          <button type="button" className="button-link" onClick={onClear}>
            Clear filters
          </button>
        </p>
      </div>
    </div>
  );
}

function FilteredGroups({ checks }: { checks: ChecksView }) {
  const [params] = useSearchParams();
  const update = useParamUpdater();
  const filters = readCatalogFilters(params);
  const review = reviewNames(checks);
  const groups = filterGroups(groupedChecks(checks), filters, review);
  const matching = checks.records.filter((record) => matchesCatalogFilters(record, filters, review)).length;
  const clear = () => update(CLEARED);
  return (
    <>
      <CatalogControls
        records={checks.records}
        review={review}
        filters={filters}
        onChange={update}
        summary={`${matching} of ${checks.records.length} checks`}
        onClear={hasCatalogFilters(filters) && matching > 0 ? clear : undefined}
      />
      {groups.length === 0 ? (
        <NoMatches onClear={clear} />
      ) : (
        groups.map((group) => <GroupSection key={group.name} group={group} />)
      )}
    </>
  );
}

function Catalog({ checks }: { checks: ChecksView }) {
  if (checks.records.length === 0) return <NoChecks checks={checks} />;
  return (
    <>
      <Totals records={checks.records} />
      <FilteredGroups checks={checks} />
      <UpForReview checks={checks} />
      <Candidates candidates={checks.candidates} />
    </>
  );
}

function CatalogContent() {
  const checks = useView("checks");
  if (checks.status === "loading") return <Loading label="Loading checks catalog…" />;
  if (checks.status === "error") {
    return <ErrorState title="The checks data could not be loaded." detail={checks.error.message} />;
  }
  return (
    <>
      <Catalog checks={checks.data} />
      <ShareLink />
    </>
  );
}

export function ChecksCatalog() {
  usePageTitle("Checks Catalog");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">Checks Catalog</h1>
      <p className="caption">
        Every health check currently collected, what it measures, whether it feeds the composite score, and how the org
        is doing on it.
      </p>
      <CatalogContent />
    </section>
  );
}

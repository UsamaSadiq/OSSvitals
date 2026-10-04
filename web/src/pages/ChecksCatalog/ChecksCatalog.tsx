import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { KpiTile } from "../../components/KpiTile";
import { Loading } from "../../components/Loading";
import { ShareLink } from "../../components/ShareLink";
import type { ChecksView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { usePageTitle } from "../../layout/pageTitle";
import { Candidates } from "./Candidates";
import { countMissingDescriptions, countScored, groupedChecks, type CheckGroup } from "./catalogData";
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

function Catalog({ checks }: { checks: ChecksView }) {
  if (checks.records.length === 0) return <NoChecks checks={checks} />;
  return (
    <>
      <Totals records={checks.records} />
      {groupedChecks(checks).map((group) => (
        <GroupSection key={group.name} group={group} />
      ))}
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

import { useState } from "react";
import { DownloadButton } from "../../components/DownloadButton";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { ShareLink } from "../../components/ShareLink";
import type { AtRiskView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import { AtRiskTable } from "./AtRiskTable";
import { AT_RISK_CAPTION, atRiskCsv, baselineCaption, visibleRows, type AtRiskRow } from "./atRiskText";
import { CodeText } from "../../components/CodeText";

function ProductionToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      Production or in a named release only
    </label>
  );
}

function AtRiskResults({ rows }: { rows: readonly AtRiskRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        kind="good"
        title="No repositories match."
        body={
          <CodeText text="Nothing with thin ownership shows an activity warning under the `stewardship_risk` rule in `attention_rules.yaml`." />
        }
      />
    );
  }
  return (
    <>
      <AtRiskTable rows={rows} />
      <div className="page-actions">
        <DownloadButton
          label="Download At-Risk List"
          filename="at-risk-ownership.csv"
          mimeType="text/csv"
          content={() => atRiskCsv(rows)}
        />
      </div>
    </>
  );
}

function LifecycleFilter({ atRisk }: { atRisk: AtRiskView }) {
  const [productionOnly, setProductionOnly] = useState(true);
  const filterable = atRisk.has_lifecycle_data && atRisk.records.length > 0;
  return (
    <>
      {filterable && <ProductionToggle checked={productionOnly} onChange={setProductionOnly} />}
      {!atRisk.has_lifecycle_data && <p className="caption">Lifecycle and release data are not in this snapshot yet.</p>}
      <AtRiskResults rows={visibleRows(atRisk.records, filterable && productionOnly)} />
    </>
  );
}

function AtRiskSections({ atRisk }: { atRisk: AtRiskView }) {
  if (!atRisk.enabled) {
    return (
      <EmptyState
        kind="info"
        title="The at-risk view is switched off for this deployment."
        body={<CodeText text="Enable `stewardship_risk` in `attention_rules.yaml`." />}
      />
    );
  }
  return (
    <>
      <p className="caption">
        <CodeText text={AT_RISK_CAPTION} />
      </p>
      {atRisk.baseline_date && (
        <p className="caption">{baselineCaption(atRisk.baseline_date, atRisk.skipped_metrics)}</p>
      )}
      <LifecycleFilter atRisk={atRisk} />
    </>
  );
}

function AtRiskContent() {
  const atRisk = useView("at_risk");
  if (atRisk.status === "loading") return <Loading label="Loading at-risk repositories…" />;
  if (atRisk.status === "error") {
    return <ErrorState title="The at-risk data could not be loaded." detail={atRisk.error.message} />;
  }
  if (!atRisk.data.has_owner_data) {
    return (
      <EmptyState
        kind="info"
        title="No owner data in this snapshot."
        body={
          <CodeText text="A repository is assessed here once its `catalog-info.yaml` sets `spec.owner` (OEP-55)." />
        }
      />
    );
  }
  return (
    <>
      <AtRiskSections atRisk={atRisk.data} />
      <ShareLink />
    </>
  );
}

export function AtRisk() {
  usePageTitle("At Risk");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">At Risk</h1>
      <SiteFreshnessBanner />
      <AtRiskContent />
    </section>
  );
}

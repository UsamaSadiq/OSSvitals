import { useState } from "react";
import { CodeText } from "../../components/CodeText";
import { DataTable, type Column } from "../../components/DataTable";
import { KpiTile } from "../../components/KpiTile";
import type { UpgradesView } from "../../data/schemas";
import { formatNumber } from "../../format";
import { MissingData } from "./MissingData";
import { JOB_STATES, JOB_STATES_CAPTION, STATE_LABELS, runsText, upgradeJobsCaption } from "./upgradesText";
import { RepoName } from "../../components/RepoName";

type UpgradeJobs = NonNullable<UpgradesView["upgrade_jobs"]>;
type JobRow = UpgradeJobs["records"][number];

function stateLabel(row: JobRow): string {
  return STATE_LABELS[row.state] ?? row.state;
}

function lastMerged(row: JobRow): string {
  return row["github.requirements_pr_last_merged"] ?? "never";
}

const COLUMNS: Column<JobRow>[] = [
  { key: "repo_name", header: "Repository", cell: (row) => <RepoName name={row.repo_name} />, sortValue: (row) => row.repo_name },
  { key: "state", header: "State", cell: stateLabel, sortValue: stateLabel },
  { key: "reason", header: "Why", cell: (row) => row.reason ?? "", sortValue: (row) => row.reason ?? "" },
  {
    key: "runs",
    header: "Failed runs",
    cell: (row) => runsText(row["github.upgrade_job_runs_failed"], row["github.upgrade_job_runs_total"]),
  },
  { key: "last_merged", header: "Last requirements PR merged", cell: lastMerged, sortValue: lastMerged },
  {
    key: "workflow_url",
    header: "Workflow",
    cell: (row) => (row.workflow_url ? <a href={row.workflow_url}>Runs</a> : ""),
  },
];

function visibleJobs(records: readonly JobRow[], includeHealthy: boolean): readonly JobRow[] {
  return includeHealthy ? records : records.filter((row) => row.state !== "healthy");
}

function StateTiles({ states }: { states: UpgradeJobs["states"] }) {
  return (
    <div className="upgrades-tiles">
      {JOB_STATES.map((state) => (
        <KpiTile key={state} label={STATE_LABELS[state] ?? state} value={formatNumber(states[state] ?? 0)} />
      ))}
    </div>
  );
}

function HealthyToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      Include healthy repos
    </label>
  );
}

function UpgradeJobsSection({ jobs }: { jobs: UpgradeJobs }) {
  const [includeHealthy, setIncludeHealthy] = useState(false);
  return (
    <>
      <p className="caption">
        <CodeText text={upgradeJobsCaption(jobs.collected_at)} />
      </p>
      <StateTiles states={jobs.states} />
      <p className="caption">{JOB_STATES_CAPTION}</p>
      <HealthyToggle checked={includeHealthy} onChange={setIncludeHealthy} />
      <DataTable
        caption="Upgrade jobs"
        captionHidden
        columns={COLUMNS}
        rows={visibleJobs(jobs.records, includeHealthy)}
        rowKey={(row) => row.repo_name}
        emptyMessage="No repos in these states."
        maxHeight="420px"
      />
    </>
  );
}

export function UpgradeJobsTab({ jobs }: { jobs: UpgradesView["upgrade_jobs"] }) {
  return jobs ? <UpgradeJobsSection jobs={jobs} /> : <MissingData what="upgrade-job" />;
}

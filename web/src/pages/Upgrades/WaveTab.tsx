import { useId } from "react";
import { CodeText } from "../../components/CodeText";
import { DataTable, type Column } from "../../components/DataTable";
import { KpiTile } from "../../components/KpiTile";
import type { UpgradesView } from "../../data/schemas";
import { formatNumber } from "../../format";
import { MissingData } from "./MissingData";
import { PullLink } from "./PullLink";
import { waveCaption, waveProgressText } from "./upgradesText";

type Wave = UpgradesView["waves"][number];
type WaveRow = NonNullable<Wave["records"]>[number];
type Summary = NonNullable<Wave["summary"]>;

const WAVE_TILES = [
  ["done", "Done"],
  ["pr_open", "PR open"],
  ["not_started", "Not started"],
] as const;

const OPEN_PR_COLUMNS: Column<WaveRow>[] = [
  { key: "repo_name", header: "Repository", cell: (row) => row.repo_name, sortValue: (row) => row.repo_name },
  {
    key: "pr_age_days",
    header: "Open for (days)",
    cell: (row) => (row.pr_age_days === null || row.pr_age_days === undefined ? "" : formatNumber(row.pr_age_days)),
    sortValue: (row) => row.pr_age_days ?? Number.NEGATIVE_INFINITY,
    numeric: true,
  },
  { key: "pr_url", header: "Migration PR", cell: (row) => <PullLink url={row.pr_url} /> },
  { key: "pr_title", header: "PR title", cell: (row) => row.pr_title ?? "", sortValue: (row) => row.pr_title ?? "" },
];

const NOT_STARTED_COLUMNS: Column<WaveRow>[] = [
  { key: "repo_name", header: "Repository", cell: (row) => row.repo_name, sortValue: (row) => row.repo_name },
  { key: "gaps", header: "Still to do", cell: (row) => row.gaps },
];

function count(summary: Summary, key: string): number {
  return summary[key] ?? 0;
}

function withStatus(records: readonly WaveRow[], status: string): WaveRow[] {
  return records.filter((row) => row.status === status);
}

function WaveHeading({ wave }: { wave: Wave }) {
  return (
    <p>
      <strong>{wave.title}</strong>
      {wave.epic && (
        <>
          {" · "}
          <a href={wave.epic}>tracking epic</a>
        </>
      )}
    </p>
  );
}

function WaveProgress({ summary }: { summary: Summary }) {
  const textId = useId();
  const percent = count(summary, "percent_done");
  const width = Math.min(Math.max(percent, 0), 100);
  return (
    <div className="upgrades-progress">
      <p className="upgrades-progress__text" id={textId}>
        {waveProgressText(count(summary, "done"), count(summary, "applicable"), percent)}
      </p>
      <div
        className="upgrades-progress__track"
        role="progressbar"
        aria-labelledby={textId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
      >
        <div className="upgrades-progress__fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function WaveTiles({ summary }: { summary: Summary }) {
  return (
    <div className="upgrades-tiles">
      {WAVE_TILES.map(([key, label]) => (
        <KpiTile key={key} label={label} value={formatNumber(count(summary, key))} />
      ))}
    </div>
  );
}

function WaveTables({ records }: { records: readonly WaveRow[] }) {
  return (
    <>
      <h2 className="upgrades-section-title">Open migration PRs, oldest first</h2>
      <DataTable
        caption="Open migration PRs, oldest first"
        captionHidden
        columns={OPEN_PR_COLUMNS}
        rows={withStatus(records, "pr_open")}
        rowKey={(row) => row.repo_name}
        initialSort={{ key: "pr_age_days", direction: "descending" }}
        emptyMessage="No migration PRs open."
        maxHeight="380px"
      />
      <h2 className="upgrades-section-title">Not started</h2>
      <DataTable
        caption="Not started"
        captionHidden
        columns={NOT_STARTED_COLUMNS}
        rows={withStatus(records, "not_started")}
        rowKey={(row) => row.repo_name}
        emptyMessage="Every applicable repo has started."
        maxHeight="380px"
      />
    </>
  );
}

function WaveSection({ wave }: { wave: Wave }) {
  const summary = wave.summary ?? {};
  return (
    <>
      <WaveHeading wave={wave} />
      <WaveProgress summary={summary} />
      <WaveTiles summary={summary} />
      <p className="caption">
        <CodeText text={waveCaption(wave.done_rule, wave.collected_at)} />
      </p>
      <WaveTables records={wave.records ?? []} />
    </>
  );
}

export function WaveTab({ wave }: { wave: Wave }) {
  return wave.available ? <WaveSection wave={wave} /> : <MissingData what={`${wave.title} wave`} />;
}

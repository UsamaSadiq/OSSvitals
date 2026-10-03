import { Fragment } from "react";
import { DataTable, type Column } from "../../components/DataTable";
import type { ScoringView } from "../../data/schemas";
import { CodeText } from "../../components/CodeText";
import {
  formatWholePercent,
  limitedRows,
  missingDefaults,
  provisionalMetrics,
  SCORES_FILE_URL,
  versionText,
  type MetricRow,
} from "./scoringText";

type LetterBand = ScoringView["letter_bands"][number];

const percentSortValue = (value: number | null) => value ?? -1;

const METRIC_COLUMNS: Column<MetricRow>[] = [
  { key: "metric", header: "Metric", cell: (row) => row.metric, sortValue: (row) => row.metric },
  { key: "category", header: "Category", cell: (row) => row.category, sortValue: (row) => row.category },
  {
    key: "weight",
    header: "Weight",
    cell: (row) => formatWholePercent(row.weight_pct),
    sortValue: (row) => row.weight_pct,
    numeric: true,
  },
  {
    key: "measured",
    header: "Measured",
    cell: (row) => formatWholePercent(row.measured_pct),
    sortValue: (row) => percentSortValue(row.measured_pct),
    numeric: true,
  },
  {
    key: "defaulted",
    header: "Defaulted",
    cell: (row) => formatWholePercent(row.defaulted_pct),
    sortValue: (row) => percentSortValue(row.defaulted_pct),
    numeric: true,
  },
  { key: "chaoss", header: "CHAOSS metric", cell: (row) => row.chaoss_metric, sortValue: (row) => row.chaoss_metric },
];

export function Intro({ version }: { version: string | null }) {
  return (
    <>
      <p>
        Each repository gets a score from 0 to 100: a weighted average of the metrics below, each scored 0 to 100
        from public data collected by the daily{" "}
        <a href="https://github.com/openedx/edx-repo-health">edx-repo-health</a> checks. The score maps to a letter
        grade. Weights, thresholds and grade bands are read from <code>scoring.yaml</code> (version{" "}
        {versionText(version)}), not hardcoded.
      </p>
      <p>
        Scores can be recomputed by anyone: the inputs are the public CSVs in{" "}
        <a href="https://github.com/openedx/wg-maintenance/tree/main/dashboards">openedx/wg-maintenance</a>, and the
        daily output is published as{" "}
        <a href={SCORES_FILE_URL}>
          <code>scores.json</code>
        </a>{" "}
        by <code>scripts/build_scores.py</code>.
      </p>
    </>
  );
}

export function GradeBands({ bands }: { bands: readonly LetterBand[] }) {
  return (
    <section className="scoring-section" aria-labelledby="grade-bands-heading">
      <h2 id="grade-bands-heading">Grade bands</h2>
      <p>
        {bands.map((band, index) => (
          <Fragment key={band.grade}>
            {index > 0 && " · "}
            <strong>{band.grade}</strong> {band.from}–{band.to}
          </Fragment>
        ))}
      </p>
    </section>
  );
}

function MetricRules({ rows }: { rows: readonly MetricRow[] }) {
  return (
    <>
      <h3>How each metric is scored</h3>
      <ul>
        {rows.map((row) => (
          <li key={row.metric}>
            <strong>{row.metric}</strong> (<code>{row.source}</code>): <CodeText text={row.rule} />
          </li>
        ))}
      </ul>
    </>
  );
}

export function Metrics({ rows }: { rows: readonly MetricRow[] }) {
  return (
    <section className="scoring-section" aria-labelledby="metrics-heading">
      <h2 id="metrics-heading">Metrics</h2>
      <DataTable
        caption="Metrics"
        captionHidden
        columns={METRIC_COLUMNS}
        rows={rows}
        rowKey={(row) => row.metric}
        emptyMessage="No metrics to show."
      />
      <p className="caption">
        Measured: share of repos with a usable value today. Defaulted: share scored with the missing-data value
        instead. Structural metrics describe repo setup; activity metrics describe recent development.
      </p>
      <MetricRules rows={rows} />
    </section>
  );
}

export function MissingData({ rows }: { rows: readonly MetricRow[] }) {
  return (
    <section className="scoring-section" aria-labelledby="missing-data-heading">
      <h2 id="missing-data-heading">Missing data</h2>
      <p>
        When a metric's value is blank or unreadable for a repo, it scores <strong>{missingDefaults(rows)}</strong>{" "}
        rather than 0, so a gap in collection is not reported as a failure. The table shows how often that happens
        today, per metric. A repo detail page marks each defaulted metric so a score built mostly on defaults is
        visible.
      </p>
    </section>
  );
}

export function Limitations({ rows }: { rows: readonly MetricRow[] }) {
  const limited = limitedRows(rows);
  const provisional = provisionalMetrics(rows);
  if (limited.length === 0 && provisional.length === 0) return null;
  return (
    <section className="scoring-section" aria-labelledby="limitations-heading">
      <h2 id="limitations-heading">Known limitations</h2>
      <ul>
        {limited.map((row) => (
          <li key={row.metric}>
            <strong>{row.metric}</strong>: <CodeText text={row.limitation} />
          </li>
        ))}
        {provisional.length > 0 && (
          <li>
            <strong>Provisional thresholds</strong> ({provisional.join(", ")}): set from current data and awaiting
            review by the Open edX Maintenance Working Group.
          </li>
        )}
      </ul>
    </section>
  );
}

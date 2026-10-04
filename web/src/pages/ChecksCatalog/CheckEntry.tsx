import { CodeText } from "../../components/CodeText";
import { KpiTile } from "../../components/KpiTile";
import {
  configGaps,
  descriptionText,
  formatPct,
  metaParts,
  scoreLine,
  type CheckRecord,
  type MetaPart,
} from "./catalogData";

function Summary({ record }: { record: CheckRecord }) {
  return (
    <summary>
      <strong>{record.title}</strong>
      {record.title !== record.check && (
        <>
          {"  ·  "}
          <code>{record.check}</code>
        </>
      )}
    </summary>
  );
}

function Description({ record }: { record: CheckRecord }) {
  const description = descriptionText(record);
  return <p>{description ? <CodeText text={description} /> : <em>No description entry yet.</em>}</p>;
}

function ScoreFeed({ record }: { record: CheckRecord }) {
  const score = scoreLine(record);
  if (!score) return <p className="caption">Not part of the composite score (informational check).</p>;
  const flag = score.computable ? "✓ computable" : "○ not yet collected";
  return (
    <p>
      <strong>Feeds score:</strong> <code>{score.metric}</code> — weight {score.weightPct}% ({flag})
    </p>
  );
}

function MetaItem({ part }: { part: MetaPart }) {
  if (!part.href) return <>{part.label}</>;
  return (
    <a href={part.href} target="_blank" rel="noreferrer">
      {part.label}
    </a>
  );
}

function MetaCaption({ record }: { record: CheckRecord }) {
  const parts = metaParts(record);
  if (parts.length === 0) return null;
  return (
    <p className="caption">
      {parts.map((part, index) => (
        <span key={part.label}>
          {index > 0 && " · "}
          <MetaItem part={part} />
        </span>
      ))}
    </p>
  );
}

function Coverage({ record }: { record: CheckRecord }) {
  return (
    <div className="checks-catalog__metrics">
      <KpiTile label="Org coverage (populated)" value={formatPct(record.populated_pct)} />
      <KpiTile label="Pass rate" value={formatPct(record.pass_pct)} />
    </div>
  );
}

function ConfigGaps({ record }: { record: CheckRecord }) {
  const gaps = configGaps(record);
  if (gaps.length === 0) return null;
  return (
    <p className="caption">
      <span aria-hidden="true">⚠️ </span>Config gaps: {gaps.join(", ")}
    </p>
  );
}

export function CheckEntry({ record }: { record: CheckRecord }) {
  return (
    <details className="checks-catalog__entry">
      <Summary record={record} />
      <div className="checks-catalog__entry-body">
        <Description record={record} />
        <ScoreFeed record={record} />
        <MetaCaption record={record} />
        <Coverage record={record} />
        <ConfigGaps record={record} />
      </div>
    </details>
  );
}

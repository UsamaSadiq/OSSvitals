import { formatNumber } from "../../format";
import { FindingReposTable } from "./ComponentTables";
import { FINDING_KIND_LABELS, findingKind, repoNoun, type FindingRow } from "./componentRows";

function FindingCard({ finding }: { finding: FindingRow }) {
  const kind = findingKind(finding);
  return (
    <li className={`finding-card finding-card--${kind}`}>
      <details>
        <summary className="finding-card__summary">
          <span className="finding-card__head">
            <span className={`finding-card__kind finding-card__kind--${kind}`}>{FINDING_KIND_LABELS[kind]}</span>
            <span className="finding-card__count">
              {formatNumber(finding.repos.length)}
              <span className="visually-hidden"> {repoNoun(finding.repos.length)}</span>
            </span>
          </span>
          <strong className="finding-card__label">{finding.label}</strong>
          <span className="finding-card__hint" aria-hidden="true">
            Repositories
          </span>
        </summary>
        <div className="finding-card__body">
          <FindingReposTable label={finding.label} repos={finding.repos} />
        </div>
      </details>
    </li>
  );
}

export function FindingCards({ findings }: { findings: readonly FindingRow[] }) {
  return (
    <ul className="finding-grid">
      {findings.map((finding) => (
        <FindingCard key={finding.code} finding={finding} />
      ))}
    </ul>
  );
}

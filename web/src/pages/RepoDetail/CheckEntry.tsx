import { CodeText } from "../../components/CodeText";
import { githubIssueUrl, githubPrCompareUrl, type PrTemplate } from "./checkLinks";
import { descriptionText, hasFix, stateLabel, type CheckRecord, type CheckRow } from "./checkRows";
import { StatusChip } from "./StatusChip";

type Remediation = NonNullable<CheckRecord["remediation"]>;

function Value({ value }: { value: string | null }) {
  return (
    <p>
      <strong>Value:</strong> {value === null ? <em>not recorded</em> : <code>{value}</code>}
    </p>
  );
}

function ExternalButton({ href, label, ariaLabel }: { href: string; label: string; ariaLabel?: string }) {
  return (
    <a className="button-link" href={href} target="_blank" rel="noreferrer" aria-label={ariaLabel}>
      {label}
    </a>
  );
}

interface FixLinks {
  issueUrl: string;
  prUrl: string | null;
}

function fixLinks(repo: string, record: CheckRecord, remediation: Remediation, allowPr: boolean): FixLinks {
  const template: PrTemplate | null = allowPr ? record.pr_template : null;
  return {
    issueUrl: githubIssueUrl(repo, record.check, remediation.issue_body),
    prUrl: template ? githubPrCompareUrl(repo, template) : null,
  };
}

function RemediationBlock({ remediation, links }: { remediation: Remediation; links: FixLinks }) {
  return (
    <>
      <p>
        <strong>Remediation</strong>
      </p>
      <p>
        <CodeText text={remediation.description} />
      </p>
      {remediation.snippet && (
        <pre>
          <code>{remediation.snippet}</code>
        </pre>
      )}
      {remediation.source_url && (
        <p>
          <a href={remediation.source_url} target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
      )}
      <div className="check-actions">
        <ExternalButton href={links.issueUrl} label="File issue on this repo" />
        {links.prUrl && <ExternalButton href={links.prUrl} label="Open PR with fix" />}
      </div>
    </>
  );
}

function RowActions({ title, links }: { title: string; links: FixLinks }) {
  return (
    <div className="check-row__actions">
      <ExternalButton href={links.issueUrl} label="File issue" ariaLabel={`File issue for ${title}`} />
      {links.prUrl && <ExternalButton href={links.prUrl} label="Open PR" ariaLabel={`Open PR for ${title}`} />}
    </div>
  );
}

export function CheckEntry({ repo, row, allowPr }: { repo: string; row: CheckRow; allowPr: boolean }) {
  const { record, state, value } = row;
  const remediation = hasFix(row) ? record.remediation : null;
  const links = remediation ? fixLinks(repo, record, remediation, allowPr) : null;
  return (
    <li className="check-row">
      <details className="check-entry">
        <summary>
          <span className="check-entry__line">
            <StatusChip status={state} label={stateLabel(state)} />
            <span className="check-entry__title">{record.title}</span>
            {remediation && <span className="fix-badge">Fix available</span>}
          </span>
        </summary>
        <div className="check-entry__body">
          <p className="caption">
            <code>{record.check}</code> · <CodeText text={descriptionText(record)} />
          </p>
          <Value value={value} />
          {remediation && links && <RemediationBlock remediation={remediation} links={links} />}
        </div>
      </details>
      {links && <RowActions title={record.title} links={links} />}
    </li>
  );
}

import { CodeText } from "../../components/CodeText";
import { githubIssueUrl, githubPrCompareUrl } from "./checkLinks";
import { descriptionText, stateMarker, type CheckRecord, type CheckRow } from "./checkRows";
import { StatusChip } from "./StatusChip";

type Remediation = NonNullable<CheckRecord["remediation"]>;

function Value({ value }: { value: string | null }) {
  return (
    <p>
      <strong>Value:</strong> {value === null ? <em>not recorded</em> : <code>{value}</code>}
    </p>
  );
}

interface RemediationProps {
  repo: string;
  record: CheckRecord;
  remediation: Remediation;
  allowPr: boolean;
}

function ExternalButton({ href, label }: { href: string; label: string }) {
  return (
    <a className="button-link" href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

function RemediationBlock({ repo, record, remediation, allowPr }: RemediationProps) {
  const template = allowPr ? record.pr_template : null;
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
        <ExternalButton href={githubIssueUrl(repo, record.check, remediation.issue_body)} label="File issue on this repo" />
        {template && <ExternalButton href={githubPrCompareUrl(repo, template)} label="Open PR with fix" />}
      </div>
    </>
  );
}

export function CheckEntry({ repo, row, allowPr }: { repo: string; row: CheckRow; allowPr: boolean }) {
  const { record, state, value } = row;
  const remediation = state === "fail" ? record.remediation : null;
  return (
    <details className="check-entry">
      <summary>
        <code>{stateMarker(state)}</code> <span>{record.title}</span>
      </summary>
      <div className="check-entry__body">
        <StatusChip status={state} label={state.toUpperCase()} />
        <p className="caption">
          <code>{record.check}</code> · <CodeText text={descriptionText(record)} />
        </p>
        <Value value={value} />
        {remediation && <RemediationBlock repo={repo} record={record} remediation={remediation} allowPr={allowPr} />}
      </div>
    </details>
  );
}

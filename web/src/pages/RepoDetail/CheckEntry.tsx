import { CodeText } from "../../components/CodeText";
import type { FixPr } from "../../data/schemas";
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

function RemediationBlock({ remediation, links }: { remediation: Remediation; links: FixLinks | null }) {
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
      {links && (
        <div className="check-actions">
          <ExternalButton href={links.issueUrl} label="File issue on this repo" />
          {links.prUrl && <ExternalButton href={links.prUrl} label="Open PR with fix" />}
        </div>
      )}
    </>
  );
}

function RowActions({ title, links, fixPr }: { title: string; links: FixLinks | null; fixPr: FixPr | null }) {
  if (fixPr) {
    return (
      <div className="check-row__actions">
        <ExternalButton href={fixPr.pr_url} label={`View PR #${fixPr.pr_number}`} ariaLabel={`View fix PR #${fixPr.pr_number} for ${title}`} />
      </div>
    );
  }
  if (!links) return null;
  return (
    <div className="check-row__actions">
      <ExternalButton href={links.issueUrl} label="File issue" ariaLabel={`File issue for ${title}`} />
      {links.prUrl && <ExternalButton href={links.prUrl} label="Open PR" ariaLabel={`Open PR for ${title}`} />}
    </div>
  );
}

export function fixPrLabel(fixPr: FixPr): string {
  const state = fixPr.is_draft ? "Draft fix PR" : "Fix PR open";
  const extra = fixPr.open_count > 1 ? ` (+${fixPr.open_count - 1} more)` : "";
  return `${state} · #${fixPr.pr_number}${extra}`;
}

function FixPrNote({ fixPr }: { fixPr: FixPr }) {
  return (
    <p>
      <strong>Fix in progress:</strong>{" "}
      <a href={fixPr.pr_url} target="_blank" rel="noreferrer">
        {fixPr.pr_title}
      </a>
      {fixPr.author ? ` by ${fixPr.author}` : ""}. Review that one instead of opening another.
    </p>
  );
}

interface CheckEntryProps {
  repo: string;
  row: CheckRow;
  allowPr: boolean;
  fixPr?: FixPr | null;
}

export function CheckEntry({ repo, row, allowPr, fixPr = null }: CheckEntryProps) {
  const { record, state, value } = row;
  const remediation = hasFix(row) ? record.remediation : null;
  const links = remediation ? fixLinks(repo, record, remediation, allowPr) : null;
  const openFix = state === "fail" ? fixPr : null;
  return (
    <li className="check-row">
      <details className="check-entry">
        <summary>
          <span className="check-entry__line">
            <StatusChip status={state} label={stateLabel(state)} />
            <span className="check-entry__title">{record.title}</span>
            {openFix ? (
              <span className="fix-badge fix-badge--open">{fixPrLabel(openFix)}</span>
            ) : (
              remediation && <span className="fix-badge">Fix available</span>
            )}
          </span>
        </summary>
        <div className="check-entry__body">
          <p className="caption">
            <code>{record.check}</code> · <CodeText text={descriptionText(record)} />
          </p>
          <Value value={value} />
          {openFix && <FixPrNote fixPr={openFix} />}
          {remediation && <RemediationBlock remediation={remediation} links={openFix ? null : links} />}
        </div>
      </details>
      <RowActions title={record.title} links={links} fixPr={openFix} />
    </li>
  );
}

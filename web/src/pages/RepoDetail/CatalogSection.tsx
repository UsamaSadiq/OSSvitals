import { Link } from "react-router";
import { CodeText } from "../../components/CodeText";
import { EmptyState } from "../../components/EmptyState";
import type { RepoDetail } from "./repoDetailData";
import { StatusChip } from "./StatusChip";

type CatalogDetail = NonNullable<RepoDetail["catalog"]>;

export const OEP_55_URL =
  "https://open-edx-proposals.readthedocs.io/en/latest/processes/oep-0055-proc-project-maintainers.html";

const SEVERITY_CHIP: Record<string, string> = { problem: "fail", note: "warn" };

export function ownerPath(ownerKey: string): string {
  return `/ownership_views?${new URLSearchParams({ owner: ownerKey }).toString()}`;
}

export function catalogCaption(collectedAt: string | null): string {
  return (
    `From catalog-info.yaml on the default branch, collected ${(collectedAt ?? "").slice(0, 10)}. ` +
    "User owners are checked against GitHub; group owners are not, since that needs openedx org membership."
  );
}

function Owner({ entry }: { entry: CatalogDetail }) {
  const code = <code>{entry.owner}</code>;
  return entry.owner_key === null ? code : <Link to={ownerPath(entry.owner_key)}>{code}</Link>;
}

function Facts({ entry }: { entry: CatalogDetail }) {
  return (
    <ul>
      <li>
        Owner: <Owner entry={entry} />
      </li>
      <li>
        Type: <strong>{entry.type}</strong>
      </li>
      <li>
        Lifecycle: <strong>{entry.lifecycle}</strong>
      </li>
      <li>
        In a named release: <strong>{entry.release}</strong>
      </li>
      <li>Architecture interest: {entry.interest}</li>
    </ul>
  );
}

function About({ entry }: { entry: CatalogDetail }) {
  const hasList = entry.links.length > 0 || entry.relations.length > 0;
  return (
    <div>
      {entry.description && (
        <p>
          <CodeText text={entry.description} />
        </p>
      )}
      {hasList && (
        <ul>
          {entry.links.map((link) => (
            <li key={`link-${link.url}-${link.title}`}>
              <a href={link.url} target="_blank" rel="noreferrer">
                {link.title}
              </a>
            </li>
          ))}
          {entry.relations.map((relation) => (
            <li key={`relation-${relation.label}-${relation.target}`}>
              {relation.label}: <code>{relation.target}</code>
              {relation.suffix}
            </li>
          ))}
        </ul>
      )}
      {entry.backstage_url && (
        <p>
          <a href={entry.backstage_url} target="_blank" rel="noreferrer">
            Open in Backstage
          </a>
        </p>
      )}
    </div>
  );
}

function Findings({ entry }: { entry: CatalogDetail }) {
  if (entry.findings.length === 0) return null;
  return (
    <div className="repo-chips">
      {entry.findings.map((finding) => (
        <StatusChip key={finding.label} status={SEVERITY_CHIP[finding.severity] ?? "warn"} label={finding.label} />
      ))}
    </div>
  );
}

function CatalogBody({ entry, collectedAt }: { entry: CatalogDetail | null; collectedAt: string | null }) {
  if (entry === null) {
    return (
      <EmptyState
        kind="info"
        title="No catalog snapshot for this repository yet."
        body="It is published daily by the collect-maintenance workflow."
      />
    );
  }
  if (!entry.has_file) {
    return (
      <EmptyState
        kind="warn"
        title="This repository has no catalog-info.yaml."
        body="Backstage does not list it and its owner is unknown. OEP-55 describes the file."
        action={{ label: "OEP-55", href: OEP_55_URL }}
      />
    );
  }
  if (!entry.has_entity) return <EmptyState kind="warn" title="catalog-info.yaml is empty or not valid YAML." />;
  return (
    <>
      <div className="repo-catalog">
        <Facts entry={entry} />
        <About entry={entry} />
      </div>
      <Findings entry={entry} />
      <p className="caption">{catalogCaption(collectedAt)}</p>
    </>
  );
}

interface CatalogSectionProps {
  available: boolean;
  entry: CatalogDetail | null;
  collectedAt: string | null;
}

export function CatalogSection({ available, entry, collectedAt }: CatalogSectionProps) {
  return (
    <section className="repo-detail-section" aria-labelledby="catalog-heading">
      <h2 id="catalog-heading">Catalog</h2>
      <CatalogBody entry={available ? entry : null} collectedAt={collectedAt} />
    </section>
  );
}

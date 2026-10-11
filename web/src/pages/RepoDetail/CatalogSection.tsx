import { Link } from "react-router";
import { CodeText } from "../../components/CodeText";
import { EmptyState } from "../../components/EmptyState";
import { ownerPath } from "../../components/ownerPath";
import { membershipNote, missingFileNote } from "../../layout/catalogCopy";
import { useCatalogName, useSiteMeta, type CatalogMeta } from "../../layout/siteMeta";
import type { RepoDetail } from "./repoDetailData";
import { StatusChip } from "./StatusChip";

type CatalogDetail = NonNullable<RepoDetail["catalog"]>;

const SEVERITY_CHIP: Record<string, string> = { problem: "fail", note: "warn" };

export function catalogCaption(collectedAt: string | null, catalog: CatalogMeta): string {
  return `From catalog-info.yaml on the default branch, collected ${(collectedAt ?? "").slice(0, 10)}. ${membershipNote(catalog)}`;
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
  const catalogName = useCatalogName();
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
            Open in {catalogName}
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
  const { catalog } = useSiteMeta();
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
        body={missingFileNote(catalog)}
        action={catalog.specName && catalog.specUrl ? { label: catalog.specName, href: catalog.specUrl } : undefined}
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
      <p className="caption">{catalogCaption(collectedAt, catalog)}</p>
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

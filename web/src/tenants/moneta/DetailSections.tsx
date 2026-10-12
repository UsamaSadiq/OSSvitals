import type { ReactNode } from "react";
import { badgeMarkdown } from "./paths";
import { formatDay, pluralise } from "./rows";
import type { AdvisoryItem, ConflictRecord, DriftRecord } from "./schemas";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="overview-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

function AdvisoryRow({ item }: { item: AdvisoryItem }) {
  const label = item.ghsa_id ?? item.summary ?? "Advisory";
  return (
    <li className="detail-row">
      {item.url ? (
        <a href={item.url} target="_blank" rel="noreferrer">
          {label}
        </a>
      ) : (
        label
      )}
      <span>{item.severity ?? "unknown severity"}</span>
      <span>{formatDay(item.published_at)}</span>
      <span>{item.after_our_release ? "after our latest release" : "before our latest release"}</span>
      {item.summary && <span className="detail-row__wide">{item.summary}</span>}
    </li>
  );
}

export function Advisories({ drift }: { drift: DriftRecord }) {
  const items = drift.advisories.items ?? [];
  if (items.length === 0) return null;
  return (
    <Section id="advisories-heading" title="Upstream advisories">
      <p className="caption">Only advisories published on GitHub are counted. Showing the {items.length} most recent.</p>
      <ul className="detail-list">
        {items.map((item) => (
          <AdvisoryRow key={`${item.ghsa_id}-${item.published_at}`} item={item} />
        ))}
      </ul>
    </Section>
  );
}

function ForecastLine({ label, clean, total }: { label: string; clean: boolean; total: number }) {
  return (
    <p>
      <strong>{label}:</strong> {clean ? "no conflicts expected" : `${pluralise(total, "file")} would conflict`}
    </p>
  );
}

export function Conflicts({ record }: { record: ConflictRecord | undefined }) {
  if (!record || record.error || !record.against_upstream_head) return null;
  const head = record.against_upstream_head;
  const release = record.against_upstream_release;
  return (
    <Section id="conflicts-heading" title="Sync forecast">
      <p className="caption">Checked weekly by merging upstream into our branch in memory. Nothing is changed.</p>
      <ForecastLine label="Upstream latest commit" clean={head.clean} total={head.conflicted_total} />
      {release && <ForecastLine label={`Upstream ${release.tag}`} clean={release.clean} total={release.conflicted_total} />}
      {head.conflicted_files.length > 0 && (
        <ul className="chip-list" aria-label="Files that would conflict">
          {head.conflicted_files.map((file) => (
            <li key={file}>
              <code>{file}</code>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function BadgeSnippet({ repo }: { repo: string }) {
  return (
    <Section id="badge-heading" title="README badge">
      <p className="caption">Paste into a README to show this fork's live upstream status.</p>
      <pre className="detail-code">
        <code>{badgeMarkdown(repo)}</code>
      </pre>
    </Section>
  );
}

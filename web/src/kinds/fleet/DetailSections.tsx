import type { ReactNode } from "react";
import { useTenant } from "../../tenants/context";
import { badgeMarkdown } from "./paths";
import { formatDay, pluralise } from "./rows";
import type { AdvisoryItem, CarriedRecord, ConflictRecord, DriftRecord } from "./schemas";

type PatchItem = NonNullable<CarriedRecord["carried_items"]>[number];

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
      {item.affects_fork_release != null && <span>{item.affects_fork_release ? "affects our base version" : "does not affect our base version"}</span>}
      {item.summary && <span className="detail-row__wide">{item.summary}</span>}
    </li>
  );
}

export function Advisories({ drift }: { drift: DriftRecord }) {
  const items = drift.advisories?.items ?? [];
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

function PatchList({ label, items, commitUrl }: { label: string; items: readonly PatchItem[]; commitUrl: (sha: string) => string }) {
  if (items.length === 0) return null;
  return (
    <>
      <h3 className="detail-subheading">{label}</h3>
      <ul className="detail-list" aria-label={label}>
      {items.map((item) => (
        <li key={item.sha}>
          <a href={commitUrl(item.sha)} target="_blank" rel="noreferrer">
            {item.subject}
          </a>
          {item.date && <span className="caption">{` ${formatDay(item.date)}`}</span>}
        </li>
      ))}
      </ul>
    </>
  );
}

function carriedSummary(record: CarriedRecord): string {
  const commits = pluralise(record.commits ?? 0, "commit");
  if (!record.compared) return `${commits} of our own. Too many to compare with upstream this week.`;
  return `${commits} of our own: ${record.carried ?? 0} carried, ${record.already_upstream ?? 0} already in upstream, which drop at the next sync.`;
}

export function CarriedPatches({ record, repoUrl }: { record: CarriedRecord | undefined; repoUrl: string }) {
  if (!record || record.error) return null;
  const commitUrl = (sha: string) => `${repoUrl}/commit/${sha}`;
  return (
    <Section id="carried-heading" title="Carried patches">
      <p className="caption">Checked weekly by comparing each of our commits with upstream's changes since our last sync. Newest first, up to 20 each.</p>
      <p>{carriedSummary(record)}</p>
      <PatchList label="Already in upstream" items={record.already_upstream_items ?? []} commitUrl={commitUrl} />
      <PatchList label="Carried" items={record.carried_items ?? []} commitUrl={commitUrl} />
    </Section>
  );
}

export function BadgeSnippet({ repo }: { repo: string }) {
  const { org } = useTenant();
  return (
    <Section id="badge-heading" title="README badge">
      <p className="caption">Paste into a README to show this fork's live upstream status.</p>
      <pre className="detail-code">
        <code>{badgeMarkdown(org, repo)}</code>
      </pre>
    </Section>
  );
}

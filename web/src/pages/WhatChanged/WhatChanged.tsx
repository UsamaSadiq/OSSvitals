import type { ReactNode } from "react";
import { EmptyState, type EmptyStateKind } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { ShareLink } from "../../components/ShareLink";
import type { WhatChangedView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import { useSiteMeta } from "../../layout/siteMeta";
import { Bulletin } from "./Bulletin";
import { ChangeTable } from "./ChangeTable";
import "./whatChanged.css";

type ChangeRows = WhatChangedView["new_failures"];

interface ChangeSectionProps {
  id: string;
  title: string;
  rows: ChangeRows;
  empty: { kind: EmptyStateKind; title: string; body: string };
}

function ChangeSection({ id, title, rows, empty }: ChangeSectionProps) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {rows.length === 0 ? (
        <EmptyState kind={empty.kind} title={empty.title} body={empty.body} />
      ) : (
        <ChangeTable caption={title} rows={rows} />
      )}
    </section>
  );
}

function NotEnoughHistory() {
  return (
    <EmptyState
      kind="warn"
      title="Not enough history to compare."
      body="At least two snapshots are needed. The accumulated history file is published by the upstream pipeline; if this persists, that file is missing or holds only one entry."
    />
  );
}

function comparisonCaption(previous: string, latest: string, snapshots: number): string {
  return `Comparing the two most recent snapshots: ${previous} → ${latest} (UTC). ${snapshots} snapshots available.`;
}

function WhatChangedSections({ view, showBulletin }: { view: WhatChangedView; showBulletin: boolean }): ReactNode {
  const { snapshots, latest, previous, new_failures, new_passes, bulletin } = view;
  if (snapshots < 2 || !latest || !previous) return <NotEnoughHistory />;
  return (
    <>
      <p className="caption">{comparisonCaption(previous, latest, snapshots)}</p>
      <ChangeSection
        id="newly-failing"
        title="Newly failing checks"
        rows={new_failures}
        empty={{ kind: "good", title: "No newly failing checks.", body: "Nothing regressed between these two snapshots." }}
      />
      <ChangeSection
        id="newly-passing"
        title="Newly passing checks"
        rows={new_passes}
        empty={{
          kind: "info",
          title: "No newly passing checks.",
          body: "Nothing was fixed between these two snapshots either.",
        }}
      />
      {showBulletin && bulletin && <Bulletin markdown={bulletin} />}
    </>
  );
}

function WhatChangedContent() {
  const view = useView("what_changed");
  const { featureFlags } = useSiteMeta();
  if (view.status === "loading") return <Loading label="Loading snapshot history…" />;
  if (view.status === "error") {
    return <ErrorState title="Unable to load snapshot history." detail={view.error.message} />;
  }
  return <WhatChangedSections view={view.data} showBulletin={featureFlags.enableWeeklyBulletinExport} />;
}

export function WhatChanged() {
  usePageTitle("What Changed");
  return (
    <section className="page what-changed" aria-labelledby="page-title">
      <h1 id="page-title">What Changed</h1>
      <SiteFreshnessBanner />
      <WhatChangedContent />
      <ShareLink />
    </section>
  );
}

import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { ShareLink } from "../../components/ShareLink";
import type { ScoringView } from "../../data/schemas";
import { useView } from "../../data/useView";
import { usePageTitle } from "../../layout/pageTitle";
import { Independence } from "./Independence";
import { GradeBands, Intro, Limitations, Metrics, MissingData } from "./MethodSections";
import { ProposedSection } from "./ProposedSection";
import "./scoring.css";

function NoScoringConfig() {
  return (
    <EmptyState
      kind="error"
      title="No scoring configuration found."
      body={
        <>
          Expected <code>dashboard/config/openedx/scoring.yaml</code> with a <code>metrics</code> section.
        </>
      }
    />
  );
}

function ScoringSections({ scoring }: { scoring: ScoringView }) {
  if (scoring.metrics.length === 0) return <NoScoringConfig />;
  return (
    <>
      <Intro version={scoring.version} />
      <GradeBands bands={scoring.letter_bands} />
      <Metrics rows={scoring.metrics} />
      <MissingData rows={scoring.metrics} />
      <Limitations rows={scoring.metrics} />
      {scoring.proposed && <ProposedSection proposed={scoring.proposed} />}
      <Independence />
      <ShareLink />
    </>
  );
}

function ScoringContent() {
  const scoring = useView("scoring");
  if (scoring.status === "loading") return <Loading label="Loading scoring method…" />;
  if (scoring.status === "error") {
    return <ErrorState title="The scoring data could not be loaded." detail={scoring.error.message} />;
  }
  return <ScoringSections scoring={scoring.data} />;
}

export function Scoring() {
  usePageTitle("How Scoring Works");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">How Scoring Works</h1>
      <ScoringContent />
    </section>
  );
}

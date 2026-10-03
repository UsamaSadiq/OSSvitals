import type { ChecksView } from "../../data/schemas";
import { candidateBuckets, type Candidate } from "./catalogData";

function candidateMeta(candidate: Candidate): string[] {
  return [
    ...(candidate.chaossMetric ? [`CHAOSS: ${candidate.chaossMetric}`] : []),
    ...(candidate.scorecardCheck ? [`Scorecard: ${candidate.scorecardCheck}`] : []),
  ];
}

function CandidateEntry({ candidate, showMeta }: { candidate: Candidate; showMeta: boolean }) {
  const meta = showMeta ? candidateMeta(candidate) : [];
  return (
    <details className="checks-catalog__entry">
      <summary>
        <strong>{candidate.name}</strong>
      </summary>
      <div className="checks-catalog__entry-body">
        <p>{candidate.rationale}</p>
        {candidate.feasibility && <p className="caption">How: {candidate.feasibility}</p>}
        {meta.length > 0 && <p className="caption">{meta.join(" · ")}</p>}
      </div>
    </details>
  );
}

function Bucket({ heading, candidates, showMeta }: { heading: string; candidates: Candidate[]; showMeta: boolean }) {
  if (candidates.length === 0) return null;
  return (
    <>
      <h3>{heading}</h3>
      {candidates.map((candidate) => (
        <CandidateEntry key={candidate.name} candidate={candidate} showMeta={showMeta} />
      ))}
    </>
  );
}

export function Candidates({ candidates }: { candidates: ChecksView["candidates"] }) {
  if (candidates.length === 0) return null;
  const { proposed, phase2 } = candidateBuckets(candidates);
  return (
    <section className="checks-catalog__section" aria-labelledby="candidate-checks">
      <h2 id="candidate-checks">Suggested candidate checks</h2>
      <p className="caption">
        Proposed additions to the health suite, informed by current community standards (CHAOSS, OpenSSF Scorecard).
        Not yet implemented.
      </p>
      <Bucket heading="Near-term (local-file checks, zero API)" candidates={proposed} showMeta />
      <Bucket heading="Phase 2 (need GitHub API / admin scope)" candidates={phase2} showMeta={false} />
    </section>
  );
}

import { useSiteMeta } from "../../layout/siteMeta";

export function Independence() {
  const { provenance, footer } = useSiteMeta();
  const checks = provenance.checksName ? `the ${provenance.checksName} checks` : "the repository health checks";
  return (
    <section className="scoring-section" aria-labelledby="independence-heading">
      <h2 id="independence-heading">Independence</h2>
      <p>
        Every check, weight, threshold and score for public repositories stays open and reproducible.
      </p>
      <p>
        Scores are not estimates: they are computed by this method from real data that {checks}
        {" "}collect from every repository through daily jobs. Labels such as "at risk" describe what those checks measure,
        not a judgement of any project or person. The dashboard is provided without warranty; to report an error,{" "}
        {footer.sourceUrl ? <a href={`${footer.sourceUrl}/issues`}>open an issue</a> : "open an issue"}.
      </p>
    </section>
  );
}

export function Independence() {
  return (
    <section className="scoring-section" aria-labelledby="independence-heading">
      <h2 id="independence-heading">Independence</h2>
      <p>
        Every check, weight, threshold and score for public repositories stays open and reproducible.
      </p>
      <p>
        Scores are not estimates: they are computed by this method from real data that the Open edX repo health checks
        collect from every repository through daily jobs. Labels such as "at risk" describe what those checks measure,
        not a judgement of any project or person. The dashboard is provided without warranty; to report an error,{" "}
        <a href="https://github.com/UsamaSadiq/OSSvitals/issues">open an issue</a>.
      </p>
    </section>
  );
}

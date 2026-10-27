import { Link } from "react-router";
import { appPath } from "./paths";
import { StatusPill } from "./StatusPill";
import { advisoryLabel, driftHeadline, isStatus, sortedForks, type ForkRow } from "./rows";

function AdvisoryBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return <p className="fork-card__advisories">{advisoryLabel(count)}</p>;
}

function ForkCard({ row }: { row: ForkRow }) {
  const { app, drift } = row;
  const headingId = `fork-${app.repo}`;
  const tone = isStatus(drift.status) ? drift.status : "unknown";
  const headline = driftHeadline(drift);
  return (
    <article className={`fork-card fork-card--${tone}`} aria-labelledby={headingId}>
      <header className="fork-card__header">
        <h3 id={headingId}>
          <Link to={appPath(app.repo)}>{app.repo}</Link>
        </h3>
        <StatusPill status={drift.status} />
      </header>
      <p className="fork-card__behind">
        <span className="fork-card__number">{headline.count.toLocaleString()}</span> {headline.text}
      </p>
      <AdvisoryBadge count={drift.advisories.since_fork_release} />
      <p className="fork-card__licence">{app.licence ?? "Licence not recorded"}</p>
    </article>
  );
}

export function ForkCards({ rows }: { rows: readonly ForkRow[] }) {
  return (
    <ul className="fork-cards">
      {sortedForks(rows).map((row) => (
        <li key={row.app.repo}>
          <ForkCard row={row} />
        </li>
      ))}
    </ul>
  );
}

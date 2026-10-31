import { Link } from "react-router";
import { licenceNotice } from "./licence";
import { appPath } from "./paths";
import { StatusPill } from "./StatusPill";
import { advisoryNotice, driftHeadline, isStatus, sortedForks, type ForkRow } from "./rows";
import { useSignalVisibility } from "./visibility";

function Notice({ text }: { text: string | null }) {
  if (text === null) return null;
  return <p className="fork-card__advisories">{text}</p>;
}

function ForkCard({ row }: { row: ForkRow }) {
  const { app, drift } = row;
  const { isShown } = useSignalVisibility();
  const headingId = `fork-${app.repo}`;
  const tone = isStatus(drift.status) ? drift.status : "unknown";
  const showGap = isShown("release_gap", "card");
  const headline = driftHeadline(drift, showGap);
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
      {isShown("advisories", "card") && <Notice text={advisoryNotice(drift, showGap)} />}
      {isShown("licence_watch", "card") && <Notice text={licenceNotice(drift.licence_watch)} />}
      <p className="fork-card__licence">{app.licence ?? "Licence not recorded"}</p>
    </article>
  );
}

export function ForkCards({ rows }: { rows: readonly ForkRow[] }) {
  const { isShown } = useSignalVisibility();
  return (
    <ul className="fork-cards">
      {sortedForks(rows, isShown("release_gap", "card")).map((row) => (
        <li key={row.app.repo}>
          <ForkCard row={row} />
        </li>
      ))}
    </ul>
  );
}

import { Link } from "react-router";
import { GradePill } from "../../components/GradePill";
import { RepoLink, RepoName } from "../../components/RepoName";
import { REPOS_PATH } from "../../components/reposPath";
import { useView } from "../../data/useView";
import { formatDelta, formatScore, NO_CHANGE } from "../../format";
import { useWatchlist } from "../../watchlist/useWatchlist";
import { WatchButton } from "../../watchlist/WatchButton";
import { watchRows, type WatchRow } from "../../watchlist/watchRows";
import { SPARKLINE_DAYS } from "./overviewText";

const WATCHED_PATH = `${REPOS_PATH}?watched=1`;

function deltaTone(delta: number): "good" | "bad" | "neutral" {
  if (formatDelta(delta, "float") === NO_CHANGE) return "neutral";
  return delta > 0 ? "good" : "bad";
}

function Delta({ delta }: { delta: number | null }) {
  const text = formatDelta(delta, "float");
  if (delta === null || text === null) return null;
  return (
    <span className={`watch-card__delta watch-card__delta--${deltaTone(delta)}`}>
      {text} <span className="watch-card__delta-span">vs {SPARKLINE_DAYS} days</span>
    </span>
  );
}

function WatchCard({ row }: { row: WatchRow }) {
  return (
    <li className="watch-card">
      <div className="watch-card__head">
        <span className="watch-card__name">
          {row.record ? <RepoLink name={row.repo} /> : <RepoName name={row.repo} />}
        </span>
        <WatchButton repo={row.repo} compact />
      </div>
      {row.record ? (
        <div className="watch-card__score">
          <GradePill grade={row.record.score_letter} />
          <span className="watch-card__value">{formatScore(row.record.score_composite)}</span>
          <Delta delta={row.delta} />
        </div>
      ) : (
        <p className="caption watch-card__missing">Not scored in this snapshot.</p>
      )}
    </li>
  );
}

export function WatchlistStrip() {
  const watchlist = useWatchlist();
  const repos = useView("repos");
  const history = useView("history");
  if (watchlist.length === 0 || !repos.data) return null;
  const rows = watchRows(watchlist, repos.data.records, history.data?.repos, SPARKLINE_DAYS);
  return (
    <section className="overview-section watchlist" aria-labelledby="watchlist-heading">
      <div className="watchlist__head">
        <h2 id="watchlist-heading">Your watchlist</h2>
        <Link to={WATCHED_PATH}>Open in Repositories →</Link>
      </div>
      <ul className="watchlist__grid">
        {rows.map((row) => (
          <WatchCard key={row.repo} row={row} />
        ))}
      </ul>
    </section>
  );
}

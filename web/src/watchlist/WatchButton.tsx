import { StarIcon } from "../components/icons";
import { toggleWatched, useIsWatched } from "./useWatchlist";
import "./watchlist.css";

interface WatchButtonProps {
  repo: string;
  compact?: boolean;
}

export function watchLabel(repo: string): string {
  return `Watch ${repo}`;
}

export function WatchButton({ repo, compact = false }: WatchButtonProps) {
  const watched = useIsWatched(repo);
  const className = compact ? "watch-button watch-button--compact" : "watch-button";
  return (
    <button
      type="button"
      className={className}
      aria-pressed={watched}
      aria-label={compact ? watchLabel(repo) : undefined}
      title={watched ? "Remove from your watchlist" : "Add to your watchlist"}
      onClick={() => toggleWatched(repo)}
    >
      <StarIcon className="watch-button__icon" />
      {!compact && <span>Watch</span>}
    </button>
  );
}

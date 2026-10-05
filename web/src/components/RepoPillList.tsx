import "./components.css";
import { formatScore } from "../format";
import { GradePill } from "./GradePill";
import { RepoLink } from "./RepoName";

export interface RepoPill {
  repo_name: string;
  score_composite: number;
  score_letter: string;
}

export function RepoPillList({ rows, label }: { rows: readonly RepoPill[]; label: string }) {
  if (rows.length === 0) return <p className="caption">No repositories.</p>;
  return (
    <ul className="repo-pills" aria-label={label}>
      {rows.map((row) => (
        <li key={row.repo_name} className="repo-pills__item">
          <span className="repo-pills__name" title={row.repo_name}>
            <RepoLink name={row.repo_name} />
          </span>
          <span className="repo-pills__score">
            <GradePill grade={row.score_letter} /> <span className="caption">{formatScore(row.score_composite)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

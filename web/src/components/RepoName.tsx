import { Link } from "react-router";
import { repoDetailPath } from "./repoDetailPath";

export function splitRepoName(name: string): { org: string; short: string } {
  const slash = name.indexOf("/");
  if (slash <= 0) return { org: "", short: name };
  return { org: name.slice(0, slash + 1), short: name.slice(slash + 1) };
}

export function RepoName({ name }: { name: string }) {
  const { org, short } = splitRepoName(name);
  return (
    <span className="repo-name">
      {org && <span className="repo-name__org">{org}</span>}
      <span className="repo-name__short">{short}</span>
    </span>
  );
}

export function RepoLink({ name }: { name: string }) {
  return (
    <Link to={repoDetailPath(name)}>
      <RepoName name={name} />
    </Link>
  );
}

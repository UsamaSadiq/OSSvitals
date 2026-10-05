import { useMemo } from "react";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { RepoLink, splitRepoName } from "../../components/RepoName";
import type { ViewName } from "../../data/schemas";
import { useView, type ViewState } from "../../data/useView";
import { usePageTitle } from "../../layout/pageTitle";
import { SiteFreshnessBanner } from "../../layout/SiteFreshnessBanner";
import { RepoBody } from "./RepoBody";
import { RepoPicker, useSelectedRepo } from "./RepoPicker";
import { containingRepos, rankRepos } from "./repoRanking";
import { findRecord } from "./repoDetailData";
import "./repoDetail.css";

function failed<Name extends ViewName>(state: ViewState<Name>): Error | undefined {
  return state.status === "error" ? state.error : undefined;
}

// A full "org/name" that is not scored is reported as such; best-match is only for partial names.
export function isUnscoredFullName(names: readonly string[], requested: string | null): boolean {
  return requested !== null && requested.includes("/") && !names.includes(requested);
}

// Streamlit always shows a repository: the requested one, else the best match for it, else the first.
export function shownRepo(names: readonly string[], requested: string | null): string | null {
  if (requested !== null && names.includes(requested)) return requested;
  if (isUnscoredFullName(names, requested)) return null;
  return rankRepos(names, requested ?? "")[0] ?? null;
}

export const SUGGESTION_LIMIT = 3;

export function suggestedRepos(names: readonly string[], requested: string): string[] {
  const { short } = splitRepoName(requested);
  return containingRepos(names, short, SUGGESTION_LIMIT).filter((name) => name !== requested);
}

function Suggestions({ repos }: { repos: readonly string[] }) {
  if (repos.length === 0) return null;
  return (
    <nav className="repo-suggestions" aria-label="Similar scored repositories">
      <span className="repo-suggestions__lead">Did you mean</span>
      <ul>
        {repos.map((name) => (
          <li key={name}>
            <RepoLink name={name} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NotScored({ repo, names }: { repo: string; names: readonly string[] }) {
  const suggestions = useMemo(() => suggestedRepos(names, repo), [names, repo]);
  return (
    <>
      <EmptyState
        kind="info"
        title={`${repo} is not scored in this snapshot.`}
        body="The repo health checks have no row for it: it may be archived, renamed, excluded from the checks, or new. Pick another repository above."
        action={{ label: "Open on GitHub", href: `https://github.com/${repo}` }}
      />
      <Suggestions repos={suggestions} />
    </>
  );
}

function RepoDetailContent() {
  const repos = useView("repos");
  const detail = useView("repo_detail");
  const [selected, select] = useSelectedRepo();
  const error = failed(repos) ?? failed(detail);
  if (error) return <ErrorState title="The repository data could not be loaded." detail={error.message} />;
  if (repos.status !== "ready" || detail.status !== "ready") return <Loading label="Loading repositories…" />;
  const names = repos.data.records.map((record) => record.repo_name);
  const shown = shownRepo(names, selected);
  const record = findRecord(repos.data.records, shown);
  const entry = shown === null ? undefined : detail.data.repos[shown];
  return (
    <>
      <RepoPicker repos={names} selected={shown} initialQuery={selected ?? ""} onSelect={select} />
      {record && entry && shown ? (
        <RepoBody repo={shown} record={record} detail={entry} detailView={detail.data} />
      ) : selected !== null && isUnscoredFullName(names, selected) ? (
        <NotScored repo={selected} names={names} />
      ) : (
        <EmptyState
          kind="info"
          title="Pick a repository to see its detail."
          body="Type part of a name above, or arrive here from a link on Overview."
        />
      )}
    </>
  );
}

export function RepoDetail() {
  usePageTitle("Repo Detail");
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">Repository Detail</h1>
      <SiteFreshnessBanner />
      <RepoDetailContent />
    </section>
  );
}

import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { usePageTitle } from "../../layout/pageTitle";
import { useSiteMeta } from "../../layout/siteMeta";
import { NotFound } from "../../pages/NotFound";
import { Advisories, BadgeSnippet, Conflicts } from "./DetailSections";
import { Sparkline } from "./Sparkline";
import { StatusPill } from "./StatusPill";
import { trendOf } from "./insights";
import { licenceHistoryUrl, licenceNotice } from "./licence";
import { APPS_PATH, compareUrl, releaseUrl } from "./paths";
import { formatDay, pluralise, releaseGapText, type ForkRow } from "./rows";
import type { ConflictRecord, DriftRecord, HistoryRow } from "./schemas";
import type { SignalKey } from "./signals";
import { useFleetViews, type FleetViews } from "./useFleetViews";
import { useSignalVisibility } from "./visibility";
import "./fleet.css";

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="app-fact">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function external(href: string, text: string) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {text}
    </a>
  );
}

function releaseText(release: DriftRecord["fork_release"]): string {
  return release ? `${release.tag}${release.date ? ` (${formatDay(release.date)})` : ""}` : "none yet";
}

function ourRelease(release: DriftRecord["fork_release"], githubOrg: string | undefined, repo: string): ReactNode {
  return release && githubOrg ? external(releaseUrl(githubOrg, repo, release.tag), releaseText(release)) : releaseText(release);
}

const STATUS_BASIS_NOTE = {
  release: "Status is judged on upstream releases and advisories affecting this base.",
  commits: "Status is judged on commits behind the upstream branch, since no upstream release was found in our history.",
} as const;

const CI_TEXT = { passing: "Passing", failing: "Failing", pending: "Running", none: "No checks" } as const;

function ReleaseFacts({ row, githubOrg }: { row: ForkRow; githubOrg: string | undefined }) {
  const { app, drift } = row;
  const { isShown } = useSignalVisibility();
  const ours = isShown("fork_release", "detail");
  const upstream = isShown("upstream_release", "detail");
  return (
    <>
      {ours && <Fact term="Our latest release">{ourRelease(drift.fork_release ?? null, githubOrg, app.repo)}</Fact>}
      {ours && drift.release_candidate && <Fact term="Release candidate pending">{drift.release_candidate.tag}</Fact>}
      {upstream && (
        <Fact term="Upstream latest release">
          {drift.upstream_release && app.upstream_url ? external(`${app.upstream_url}/releases`, releaseText(drift.upstream_release)) : "–"}
        </Fact>
      )}
      {upstream && drift.release_lag && (
        <Fact term="Upstream releases since our last sync">
          {drift.release_lag.upstream_releases_since_sync}
          {drift.release_lag.upstream_ahead_of_our_release_days !== null &&
            `, upstream's newest is ${drift.release_lag.upstream_ahead_of_our_release_days} days newer than ours`}
        </Fact>
      )}
    </>
  );
}

function ForkFacts({ row, githubOrg }: { row: ForkRow; githubOrg: string | undefined }) {
  const { drift } = row;
  const { advisories, promotion, ci, pull_requests: pulls, upstream_activity: activity } = drift;
  const { isShown } = useSignalVisibility();
  const shown = (key: SignalKey) => isShown(key, "detail");
  return (
    <>
      {shown("release_gap") && <Fact term="Built on upstream">
        {drift.release_gap ? releaseGapText(drift.release_gap) : "No upstream release found in our history"}
        {drift.release_gap && drift.release_gap.releases_behind > 0 && (
          <span className="app-fact__note">{`The oldest upstream release we lack came out ${drift.release_gap.days_behind} days ago.`}</span>
        )}
        <span className="app-fact__note">{STATUS_BASIS_NOTE[drift.status_basis ?? "commits"]}</span>
      </Fact>}
      <Fact term="Behind upstream">{pluralise(drift.behind_by, "commit")}</Fact>
      {shown("upstream_release") && drift.behind_release != null && drift.upstream_release && (
        <Fact term="Behind latest release">{`${pluralise(drift.behind_release, "commit")} behind ${drift.upstream_release.tag}`}</Fact>
      )}
      <Fact term="Our patches">{pluralise(drift.ahead_by, "commit")}</Fact>
      <Fact term="Last upstream sync">
        {formatDay(drift.last_upstream_merge)} ({drift.days_since_upstream_merge} days ago)
      </Fact>
      <ReleaseFacts row={row} githubOrg={githubOrg} />
      {shown("advisories") && advisories && (
        <Fact term="Upstream advisories">
          {advisories.since_fork_release} published after our latest release, {advisories.published} in total
          {advisories.base_release &&
            `, ${advisories.affecting_fork_release ?? 0} affecting ${shown("release_gap") ? `${advisories.base_release}, the upstream version we are based on` : "the upstream release we are built on"}`}
        </Fact>
      )}
      {shown("promotion") && (
        <Fact term="Not yet promoted">
          {promotion ? `${pluralise(promotion.unpromoted_commits, "commit")} on staging not yet released` : "No staging branch"}
        </Fact>
      )}
      {shown("ci") && ci && <Fact term="Checks on our release branch">{CI_TEXT[ci.state]}</Fact>}
      {shown("pull_requests") && pulls && (
        <Fact term="Open pull requests">
          {pulls.open}
          {pulls.sync_pull && <> · {external(pulls.sync_pull.url, `upstream sync open (#${pulls.sync_pull.number})`)}</>}
        </Fact>
      )}
      {shown("upstream_activity") && activity && (
        <Fact term="Upstream activity">
          Last push {formatDay(activity.pushed_at)}
          {activity.quiet && " (quiet)"}
        </Fact>
      )}
      {shown("licence_watch") && drift.licence_watch && <LicenceFact row={row} />}
    </>
  );
}

function LicenceFact({ row }: { row: ForkRow }) {
  const { app, drift } = row;
  const watch = drift.licence_watch;
  if (!watch) return null;
  const branch = app.upstream_branch ?? "";
  const notice = licenceNotice(watch);
  const file = watch.path && app.upstream_url ? external(licenceHistoryUrl(app.upstream_url, branch, watch.path), `${watch.path} on ${branch}`) : null;
  return (
    <Fact term="Upstream licence">
      {watch.present ? (
        <>
          {watch.spdx ?? "Not recognised by GitHub"}
          {file && <> ({file})</>}
        </>
      ) : (
        `No licence file on ${branch}`
      )}
      {notice && <span className="app-fact__note">{notice}</span>}
    </Fact>
  );
}

function Links({ row, githubOrg }: { row: ForkRow; githubOrg: string | undefined }) {
  const { app } = row;
  const canCompare = githubOrg && app.upstream && app.upstream_branch && app.production_branch;
  return (
    <ul className="app-links">
      <li>{external(app.url, "Our repository")}</li>
      {app.upstream_url && <li>{external(app.upstream_url, "Upstream repository")}</li>}
      {canCompare && (
        <li>{external(compareUrl(githubOrg, app.repo, app.upstream ?? "", app.upstream_branch ?? "", app.production_branch ?? ""), "Compare our branch with upstream")}</li>
      )}
      {app.runbook_url && <li>{external(app.runbook_url, "Sync runbook")}</li>}
    </ul>
  );
}

function Integrations({ row }: { row: ForkRow }) {
  const { app } = row;
  const mcp = app.mcp_server;
  return (
    <>
      {mcp && (
        <Fact term="MCP server">
          {external(app.url.replace(/[^/]+$/, mcp), mcp)}
        </Fact>
      )}
      {app.sso && <Fact term="Single sign-on">{app.sso}</Fact>}
      {app.e2e && <Fact term="End-to-end tests">{app.e2e}</Fact>}
    </>
  );
}

function maintainersText(maintainers: DriftRecord["maintainers"]): string {
  if (!maintainers) return "Not available";
  if (maintainers.length === 0) return "No pull requests merged in our fork yet";
  return maintainers.map(({ login, merged }) => `${login} (${merged})`).join(", ");
}

function Maintainers({ drift }: { drift: DriftRecord }) {
  return (
    <Fact term="Maintainers">
      {maintainersText(drift.maintainers)}
      <span className="app-fact__note">Everyone who has merged a pull request into our release branch, with how many. Upstream maintainers are not included.</span>
    </Fact>
  );
}

function Facts({ row, githubOrg }: { row: ForkRow; githubOrg: string | undefined }) {
  const { app, drift } = row;
  const { isShown } = useSignalVisibility();
  return (
    <dl className="app-facts">
      <ForkFacts row={row} githubOrg={githubOrg} />
      <Fact term="Licence">
        {app.licence ?? "Not recorded"}
        {app.licence_note && <span className="app-fact__note">{app.licence_note}</span>}
      </Fact>
      <Fact term="Upstream project">{app.upstream ?? "–"}</Fact>
      <Integrations row={row} />
      {isShown("maintainers", "detail") && <Maintainers drift={drift} />}
    </dl>
  );
}

interface DetailProps {
  row: ForkRow;
  githubOrg: string | undefined;
  history: readonly HistoryRow[];
  conflict: ConflictRecord | undefined;
}

function Detail({ row, githubOrg, history, conflict }: DetailProps) {
  const { app, drift } = row;
  const { isShown } = useSignalVisibility();
  usePageTitle(app.repo);
  return (
    <section className="page app-detail" aria-labelledby="page-title">
      <p>
        <Link to={APPS_PATH}>← All apps</Link>
      </p>
      <h1 id="page-title">
        {app.repo} <StatusPill status={drift.status} />
      </h1>
      {app.description && <p className="caption">{app.description}</p>}
      {app.purpose && <p>{app.purpose}</p>}
      <Facts row={row} githubOrg={githubOrg} />
      <section className="overview-section" aria-labelledby="trend-heading">
        <h2 id="trend-heading">Trend</h2>
        <Sparkline points={trendOf(history, app.repo)} />
      </section>
      {app.what_we_changed && (
        <section className="overview-section" aria-labelledby="notes-heading">
          <h2 id="notes-heading">Our changes in brief</h2>
          <p className="detail-notes">{app.what_we_changed}</p>
        </section>
      )}
      {isShown("advisories", "detail") && <Advisories drift={drift} />}
      {isShown("conflicts", "detail") && <Conflicts record={conflict} />}
      <section className="overview-section" aria-labelledby="links-heading">
        <h2 id="links-heading">Links</h2>
        <Links row={row} githubOrg={githubOrg} />
      </section>
      <BadgeSnippet repo={app.repo} />
    </section>
  );
}

function Resolved({ repo, views, githubOrg }: { repo: string; views: FleetViews; githubOrg: string | undefined }) {
  const app = views.apps.records.find((record) => record.repo === repo && record.class === "fork");
  const drift = views.drift.records.find((record) => record.repo === repo);
  if (!app || !drift) return <NotFound />;
  const conflict = views.conflicts?.records.find((record) => record.repo === repo);
  return <Detail row={{ app, drift }} githubOrg={githubOrg} history={views.history?.records ?? []} conflict={conflict} />;
}

export function AppDetail() {
  const { repo = "" } = useParams();
  const { githubOrg } = useSiteMeta();
  const state = useFleetViews();
  if (state.status === "loading") return <Loading label="Loading fork details…" />;
  if (state.status === "error") return <ErrorState title="The fork status data could not be loaded." detail={state.message} />;
  return <Resolved repo={repo} views={state} githubOrg={githubOrg} />;
}

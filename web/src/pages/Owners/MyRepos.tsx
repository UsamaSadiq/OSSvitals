import { useId, useState } from "react";
import { CodeText } from "../../components/CodeText";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Loading } from "../../components/Loading";
import { useView } from "../../data/useView";
import { useSiteMeta } from "../../layout/siteMeta";
import { HandleReposTable } from "./OwnerTables";
import { MY_REPOS_CAPTION, normalizeHandle, reposForHandle } from "./ownerText";

function HandleResults({ handle }: { handle: string }) {
  const repos = useView("repos");
  if (repos.status === "loading") return <Loading label="Loading repositories…" />;
  if (repos.status === "error") {
    return <ErrorState title="The repository data could not be loaded." detail={repos.error.message} />;
  }
  const mine = reposForHandle(repos.data.records, normalizeHandle(handle));
  if (mine.length === 0) {
    return (
      <EmptyState
        kind="info"
        title="No repositories matched that handle."
        body="Ownership fields are largely unpopulated, so most repositories cannot be matched to anyone yet."
      />
    );
  }
  return <HandleReposTable rows={mine} />;
}

function HandleSearch() {
  const id = useId();
  const [handle, setHandle] = useState("");
  return (
    <>
      <p className="caption">{MY_REPOS_CAPTION}</p>
      <div className="owners-handle">
        <label htmlFor={id}>GitHub handle</label>
        <input
          id={id}
          type="text"
          value={handle}
          placeholder="e.g. openedx"
          onChange={(event) => setHandle(event.target.value)}
        />
      </div>
      {handle.trim() && <HandleResults handle={handle} />}
    </>
  );
}

export function MyRepos() {
  const { featureFlags } = useSiteMeta();
  if (!featureFlags.enableMyReposFilter) {
    return (
      <EmptyState
        kind="info"
        title="This view is switched off for this deployment."
        body={<CodeText text="Enable `enable_my_repos_filter` in `dashboard/config/feature_flags.yaml`." />}
      />
    );
  }
  return <HandleSearch />;
}

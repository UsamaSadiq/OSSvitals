import { useEffect } from "react";
import { useRouteError } from "react-router";
import { isStaleChunkError, reloadForNewBuild } from "./staleChunk";

function StaleBuild() {
  useEffect(() => {
    reloadForNewBuild();
  }, []);
  return (
    <main className="route-error">
      <h1>This page has been updated</h1>
      <p className="page-lede">A new version of the dashboard was published while this tab was open. Reload to get it.</p>
      <button type="button" className="button-link" onClick={() => window.location.reload()}>
        Reload
      </button>
    </main>
  );
}

export function RouteError() {
  const error = useRouteError();
  if (isStaleChunkError(error)) return <StaleBuild />;
  return (
    <main className="route-error">
      <h1>Something went wrong</h1>
      <p className="page-lede">This page could not be shown. Reloading usually helps; if it keeps happening, report it.</p>
      <p className="caption">{error instanceof Error ? error.message : String(error)}</p>
      <button type="button" className="button-link" onClick={() => window.location.reload()}>
        Reload
      </button>
    </main>
  );
}

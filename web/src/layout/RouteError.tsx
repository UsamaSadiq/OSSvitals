import { useEffect } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { isReloadPending, isStaleChunkError, reloadForNewBuild } from "./staleChunk";

function errorText(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`.trim();
  return error instanceof Error ? error.message : "Unknown error";
}

function ErrorActions() {
  return (
    <p className="route-error__actions">
      <button type="button" className="button-link" onClick={() => window.location.reload()}>
        Reload
      </button>
      <a href="/">Go to the Overview</a>
    </p>
  );
}

function StaleBuild() {
  useEffect(() => {
    reloadForNewBuild();
  }, []);
  return (
    <section className="route-error" aria-labelledby="route-error-title">
      <h1 id="route-error-title">This page has been updated</h1>
      <p className="page-lede">A new version of the dashboard was published while this tab was open. Reload to get it.</p>
      <ErrorActions />
    </section>
  );
}

export function RouteError() {
  const error = useRouteError();
  if (isReloadPending() || isStaleChunkError(error)) return <StaleBuild />;
  return (
    <section className="route-error" aria-labelledby="route-error-title">
      <h1 id="route-error-title">Something went wrong</h1>
      <p className="page-lede">This page could not be shown. Reloading usually helps; if it keeps happening, report it.</p>
      <p className="caption">{errorText(error)}</p>
      <ErrorActions />
    </section>
  );
}

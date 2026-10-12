import { useMemo } from "react";
import { pageItems, type PaletteItem } from "../../search/paletteItems";
import type { PaletteHostProps } from "../types";
import { appPath } from "./paths";
import { forkRows } from "./rows";
import { useMonetaViews } from "./useMonetaViews";

export function MonetaPaletteHost({ pages, children }: PaletteHostProps) {
  const state = useMonetaViews();
  const apps = useMemo<PaletteItem[]>(() => {
    if (state.status !== "ready") return [];
    return forkRows(state.apps.records, state.drift.records).map(({ app, drift }) => ({
      id: `app:${app.repo}`,
      section: "apps",
      label: app.repo,
      keys: [app.repo, app.upstream ?? ""],
      detail: drift.status,
      to: appPath(app.repo),
    }));
  }, [state]);
  const unavailable = state.status === "error" ? ["apps"] : [];
  return <>{children({ items: { pages: pageItems(pages), apps }, loading: state.status === "loading", unavailable })}</>;
}

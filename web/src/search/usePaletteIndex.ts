import { useMemo } from "react";
import type { ViewName } from "../data/schemas";
import { useView, type ViewState } from "../data/useView";
import type { PageEntry } from "../pages/catalog";
import {
  checkItems,
  failingCheckNames,
  ownerItems,
  pageItems,
  repoItems,
  type PaletteItem,
  type SectionId,
} from "./paletteItems";

export interface PaletteIndex {
  items: Partial<Record<SectionId, PaletteItem[]>>;
  loading: boolean;
  unavailable: string[];
}

const NO_FAILING_CHECKS: ReadonlySet<string> = new Set();

function isLoading(state: ViewState<ViewName> | null): boolean {
  return state?.status === "loading";
}

function failedLabels(entries: readonly [string, ViewState<ViewName> | null][]): string[] {
  return entries.filter(([, state]) => state?.status === "error").map(([label]) => label);
}

export function usePaletteIndex(pages: readonly PageEntry[], owners: ViewState<"owners"> | null): PaletteIndex {
  const repos = useView("repos");
  const checks = useView("checks");
  const failing = useView("failing_checks");

  return useMemo(() => {
    const failingNames = failing.data ? failingCheckNames(failing.data) : NO_FAILING_CHECKS;
    const checksReady = checks.data && failing.status !== "loading";
    return {
      items: {
        pages: pageItems(pages),
        repos: repos.data ? repoItems(repos.data.records) : undefined,
        checks: checksReady ? checkItems(checks.data.records, failingNames) : undefined,
        owners: owners?.data ? ownerItems(owners.data.records) : undefined,
      },
      loading: [repos, checks, failing, owners].some(isLoading),
      unavailable: failedLabels([
        ["repositories", repos],
        ["checks", checks],
        ["owners", owners],
      ]),
    };
  }, [pages, repos, checks, failing, owners]);
}

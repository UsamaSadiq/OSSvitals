import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { Loading } from "../components/Loading";

type PageComponent = LazyExoticComponent<ComponentType>;

function lazyPage<Module>(load: () => Promise<Module>, pick: (module: Module) => ComponentType): PageComponent {
  return lazy(() => load().then((module) => ({ default: pick(module) })));
}

export const PORTED_PAGES: Record<string, PageComponent> = {
  "/needing_attention": lazyPage(() => import("./NeedingAttention/NeedingAttention"), (m) => m.NeedingAttention),
  "/what_changed": lazyPage(() => import("./WhatChanged/WhatChanged"), (m) => m.WhatChanged),
  "/at_risk": lazyPage(() => import("./AtRisk/AtRisk"), (m) => m.AtRisk),
  "/scoring": lazyPage(() => import("./Scoring/Scoring"), (m) => m.Scoring),
};

export function PageLoader({ page: Page }: { page: PageComponent }) {
  return (
    <Suspense fallback={<Loading label="Loading page…" />}>
      <Page />
    </Suspense>
  );
}

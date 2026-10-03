import "./components.css";
import { lazy, Suspense } from "react";
import { Loading } from "./Loading";
import type { PlotFigureProps } from "./PlotFigureImpl";

const LazyPlotFigure = lazy(() => import("./PlotFigureImpl"));

export type { PlotFigureProps };

export function PlotFigure(props: PlotFigureProps) {
  return (
    <Suspense fallback={<Loading label="Loading chart…" />}>
      <LazyPlotFigure {...props} />
    </Suspense>
  );
}

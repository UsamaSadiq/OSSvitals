import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ChartSpec } from "./chartSpec";
import { renderPlot, type LinkHandler } from "./renderPlot";

export interface PlotFigureProps {
  spec: ChartSpec;
  ariaLabel: string;
  onLink?: LinkHandler;
}

// Text metrics shift once the web font loads; measuring before that leaves a chart a sub-pixel off.
function useFontsReady(): boolean {
  const [ready, setReady] = useState(() => typeof document === "undefined" || !document.fonts);
  useEffect(() => {
    if (ready) return;
    let active = true;
    document.fonts.ready.then(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, [ready]);
  return ready;
}

// Charts draw only at a measured width: a guessed fallback could stick if no later resize arrives.
function useContainerWidth(ref: RefObject<HTMLElement | null>, fontsReady: boolean): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !fontsReady) return;
    const measure = () => {
      const measured = element.clientWidth;
      if (measured > 0) setWidth(measured);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, fontsReady]);

  return width;
}

// Read through a ref so a new handler identity never redraws the chart.
function useLatestLink(onLink: LinkHandler | undefined): LinkHandler | undefined {
  const ref = useRef(onLink);
  useEffect(() => {
    ref.current = onLink;
  }, [onLink]);
  const hasLink = onLink !== undefined;
  return useMemo(() => (hasLink ? (to: string) => ref.current?.(to) : undefined), [hasLink]);
}

export default function PlotFigureImpl({ spec, ariaLabel, onLink }: PlotFigureProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const link = useLatestLink(onLink);
  const fontsReady = useFontsReady();
  const width = useContainerWidth(containerRef, fontsReady);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !fontsReady || width === null) return;
    const figure = renderPlot(spec, width, ariaLabel, link);
    container.append(figure);
    return () => figure.remove();
  }, [spec, width, ariaLabel, fontsReady, link]);

  return <div className="plot-figure" ref={containerRef} />;
}

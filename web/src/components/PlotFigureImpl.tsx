import { useEffect, useRef, useState, type RefObject } from "react";
import type { ChartSpec } from "./chartSpec";
import { renderPlot } from "./renderPlot";

const FALLBACK_WIDTH = 640;

export interface PlotFigureProps {
  spec: ChartSpec;
  ariaLabel: string;
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

function useContainerWidth(ref: RefObject<HTMLElement | null>, fontsReady: boolean): number {
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useEffect(() => {
    const element = ref.current;
    if (!element || !fontsReady) return;
    const measure = () => setWidth(element.clientWidth || FALLBACK_WIDTH);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, fontsReady]);

  return width;
}

export default function PlotFigureImpl({ spec, ariaLabel }: PlotFigureProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fontsReady = useFontsReady();
  const width = useContainerWidth(containerRef, fontsReady);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !fontsReady) return;
    const figure = renderPlot(spec, width, ariaLabel);
    container.append(figure);
    return () => figure.remove();
  }, [spec, width, ariaLabel, fontsReady]);

  return <div className="plot-figure" ref={containerRef} />;
}

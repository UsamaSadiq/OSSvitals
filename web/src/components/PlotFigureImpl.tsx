import { useEffect, useRef, useState, type RefObject } from "react";
import type { ChartSpec } from "./chartSpec";
import { renderPlot } from "./renderPlot";

const FALLBACK_WIDTH = 640;

export interface PlotFigureProps {
  spec: ChartSpec;
  ariaLabel: string;
}

function useContainerWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth || FALLBACK_WIDTH);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

export default function PlotFigureImpl({ spec, ariaLabel }: PlotFigureProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const figure = renderPlot(spec, width, ariaLabel);
    container.append(figure);
    return () => figure.remove();
  }, [spec, width, ariaLabel]);

  return <div className="plot-figure" ref={containerRef} />;
}

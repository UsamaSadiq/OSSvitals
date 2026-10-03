import { useMemo } from "react";
import { PlotFigure } from "../../components/PlotFigure";
import type { Chart } from "../../components/charts";

export function ChartPanel<Input>({ input, build }: { input: Input; build: (input: Input) => Chart }) {
  const chart = useMemo(() => build(input), [input, build]);
  return (
    <figure className="chart">
      {chart.summary && <figcaption className="caption chart__summary">{chart.summary}</figcaption>}
      <PlotFigure spec={chart.spec} ariaLabel={chart.ariaLabel} />
    </figure>
  );
}

import { useMemo } from "react";
import { ChartFigure } from "../../components/ChartFigure";
import type { Chart } from "../../components/charts";

export function ChartPanel<Input>({ input, build }: { input: Input; build: (input: Input) => Chart }) {
  const chart = useMemo(() => build(input), [input, build]);
  return <ChartFigure chart={chart} />;
}

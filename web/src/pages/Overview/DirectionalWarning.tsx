import { directionalDetail, isDirectional } from "./overviewText";

interface DirectionalWarningProps {
  measuredWeight: number;
  unavailableMetrics: readonly string[];
}

export function DirectionalWarning({ measuredWeight, unavailableMetrics }: DirectionalWarningProps) {
  if (!isDirectional(measuredWeight)) return null;
  return (
    <div className="banner banner--warn" role="status">
      <strong>Scores are directional.</strong> {directionalDetail(measuredWeight, unavailableMetrics)}
    </div>
  );
}

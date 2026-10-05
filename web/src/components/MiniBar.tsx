import { toFixedHalfEven } from "../format";
import "./controls.css";

export function passBand(percent: number): "low" | "mid" | "high" {
  if (percent < 50) return "low";
  return percent < 80 ? "mid" : "high";
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function MiniBar({ percent, empty = "—" }: { percent: number | null; empty?: string }) {
  if (percent === null) return <span className="mini-bar">{empty}</span>;
  return (
    <span className="mini-bar">
      <span className="mini-bar__track" aria-hidden="true">
        <span
          className={`mini-bar__fill mini-bar__fill--${passBand(percent)}`}
          style={{ width: `${clampPercent(percent)}%` }}
        />
      </span>
      {toFixedHalfEven(percent, 1)}%
    </span>
  );
}

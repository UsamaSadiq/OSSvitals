import "./components.css";
import { useId, type ReactNode } from "react";
import type { KpiDelta } from "./kpiDelta";

const ARROWS: Record<KpiDelta["direction"], string> = { up: "↑", down: "↓", flat: "" };

interface KpiTileProps {
  label: string;
  value: ReactNode;
  delta?: KpiDelta | null;
  help?: string;
}

function DeltaBadge({ delta }: { delta: KpiDelta }) {
  const arrow = ARROWS[delta.direction];
  return (
    <p className={`kpi-tile__delta kpi-tile__delta--${delta.tone}`}>
      {arrow && <span aria-hidden="true">{arrow} </span>}
      {delta.text}
    </p>
  );
}

function HelpDisclosure({ label, help }: { label: string; help: string }) {
  return (
    <details className="kpi-tile__help">
      <summary aria-label={`About ${label}`}>?</summary>
      <p>{help}</p>
    </details>
  );
}

export function KpiTile({ label, value, delta, help }: KpiTileProps) {
  const labelId = useId();
  return (
    <div className="kpi-tile" role="group" aria-labelledby={labelId}>
      <div className="kpi-tile__header">
        <p className="kpi-tile__label" id={labelId}>
          {label}
        </p>
        {help && <HelpDisclosure label={label} help={help} />}
      </div>
      <p className="kpi-tile__value">{value}</p>
      {delta && <DeltaBadge delta={delta} />}
    </div>
  );
}

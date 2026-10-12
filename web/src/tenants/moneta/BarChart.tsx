import type { CSSProperties } from "react";
import { Link } from "react-router";
import type { OverviewStat } from "./rows";

interface BarChartProps {
  label: string;
  items: readonly OverviewStat[];
  tone: (item: OverviewStat) => string;
}

const NEUTRAL = "neutral";

export function neutralTone(): string {
  return NEUTRAL;
}

export function BarChart({ label, items, tone }: BarChartProps) {
  const tallest = Math.max(1, ...items.map((item) => item.count));
  const style = { "--columns": items.length } as CSSProperties;
  return (
    <nav className="bar-chart" aria-label={label}>
      <ul className="bar-chart__columns" style={style}>
        {items.map((item) => (
          <li key={item.key}>
            <Link to={item.to} className="bar-chart__column" aria-label={`${item.label}: ${item.count}`}>
              <span className="bar-chart__plot">
                <span className="bar-chart__count">{item.count}</span>
                <span
                  className={`bar-chart__bar bar-chart__bar--${tone(item)}`}
                  style={{ height: `calc((100% - 2rem) * ${item.count / tallest})` }}
                />
              </span>
              <span className="bar-chart__label" aria-hidden="true">
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

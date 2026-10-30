import type { SupportCycle, SupportProduct } from "../../data/schemas";
import { barFor, cycleLabel, todayOffset, yearTicks, type TimeRange } from "./supportRows";

interface TimelineProps {
  products: readonly SupportProduct[];
  range: TimeRange;
  today: Date;
}

function YearAxis({ range }: { range: TimeRange }) {
  return (
    <div className="sw-timeline__row" aria-hidden="true">
      <span />
      <div className="sw-timeline__axis">
        {yearTicks(range).map((tick) => (
          <span key={tick.year} className="sw-timeline__tick" style={{ left: `${tick.left}%` }}>
            {tick.year}
          </span>
        ))}
      </div>
    </div>
  );
}

function barClasses(product: SupportProduct, cycle: SupportCycle, openEnded: boolean): string {
  const classes = ["sw-bar", cycle.current && `sw-bar--current sw-bar--${product.status}`, openEnded && "sw-bar--open"];
  return classes.filter(Boolean).join(" ");
}

function CycleRow({ product, cycle, range, now }: { product: SupportProduct; cycle: SupportCycle; range: TimeRange; now: number }) {
  const bar = barFor(cycle, range);
  if (!bar) return null;
  return (
    <li className="sw-timeline__row" aria-label={cycleLabel(product, cycle)}>
      <span className="sw-timeline__cycle" aria-hidden="true">
        {cycle.cycle}
      </span>
      <div className="sw-timeline__track" aria-hidden="true">
        <span className="sw-timeline__today" style={{ left: `${now}%` }} />
        <span className={barClasses(product, cycle, bar.openEnded)} style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />
      </div>
    </li>
  );
}

export function Timeline({ products, range, today }: TimelineProps) {
  const now = todayOffset(today, range);
  return (
    <div className="sw-timeline" role="region" aria-label="Release calendar" tabIndex={0}>
      <YearAxis range={range} />
      {products.map((product) => (
        <div key={product.product} className="sw-timeline__product">
          <h3 className="sw-timeline__label">{product.label}</h3>
          <ul className="sw-timeline__cycles" aria-label={`${product.label} release cycles`}>
            {product.cycles.map((cycle) => (
              <CycleRow key={cycle.cycle} product={product} cycle={cycle} range={range} now={now} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

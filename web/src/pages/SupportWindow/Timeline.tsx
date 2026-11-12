import type { CSSProperties } from "react";
import type { SupportCycle, SupportProduct } from "../../data/schemas";
import { StatusChip } from "./StatusChip";
import {
  barFor,
  barText,
  cycleLabel,
  isReleaseBand,
  labelAnchor,
  productHue,
  quarterTicks,
  RELEASE_LANES,
  releaseLane,
  todayOffset,
  yearTicks,
  type Bar,
  type TimeRange,
} from "./supportRows";

interface TimelineProps {
  products: readonly SupportProduct[];
  range: TimeRange;
  today: Date;
}

interface PlacedCycle {
  cycle: SupportCycle;
  bar: Bar;
}

function placedCycles(product: SupportProduct, range: TimeRange): PlacedCycle[] {
  return product.cycles.flatMap((cycle) => {
    const bar = barFor(cycle, range);
    return bar ? [{ cycle, bar }] : [];
  });
}

function Grid({ range, now }: { range: TimeRange; now: number }) {
  return (
    <div className="sw-timeline__grid" aria-hidden="true">
      {quarterTicks(range).map((left) => (
        <span key={left} className="sw-timeline__gridline sw-timeline__gridline--quarter" style={{ left: `${left}%` }} />
      ))}
      {yearTicks(range).map((tick) => (
        <span key={tick.year} className="sw-timeline__gridline" style={{ left: `${tick.left}%` }} />
      ))}
      <span className="sw-timeline__today" style={{ left: `${now}%` }} />
    </div>
  );
}

function YearAxis({ range, now }: { range: TimeRange; now: number }) {
  return (
    <div className="sw-timeline__axis" aria-hidden="true">
      {yearTicks(range).map((tick) => (
        <span key={tick.year} className="sw-timeline__year" style={{ left: `${tick.left}%` }}>
          {tick.year}
        </span>
      ))}
      <span className="sw-timeline__today-label" style={{ left: `${now}%` }}>
        Today
      </span>
    </div>
  );
}

function barClasses(cycle: SupportCycle, bar: Bar): string {
  const classes = [
    "sw-bar",
    cycle.current && "sw-bar--current",
    bar.openEnded && "sw-bar--open",
    bar.clippedStart && "sw-bar--clipped-start",
    bar.clippedEnd && "sw-bar--clipped-end",
  ];
  return classes.filter(Boolean).join(" ");
}

function labelStyle(bar: Bar): CSSProperties {
  return labelAnchor(bar) === "start" ? { left: `${bar.left}%` } : { right: `${100 - bar.left - bar.width}%` };
}

function CycleBar({ product, placed }: { product: SupportProduct; placed: PlacedCycle }) {
  const { cycle, bar } = placed;
  const labelClasses = ["sw-bar__label", `sw-bar__label--${labelAnchor(bar)}`, cycle.current && "sw-bar__label--current"];
  return (
    <>
      <span className={barClasses(cycle, bar)} style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />
      <span className={labelClasses.filter(Boolean).join(" ")} style={labelStyle(bar)}>
        {barText(product, cycle)}
      </span>
    </>
  );
}

function CycleRows({ product, placed }: { product: SupportProduct; placed: readonly PlacedCycle[] }) {
  return (
    <ul className="sw-timeline__cycles" aria-label={`${product.label} release cycles`}>
      {placed.map((item) => (
        <li key={item.cycle.cycle} className="sw-timeline__track" aria-label={cycleLabel(product, item.cycle)}>
          <span aria-hidden="true">
            <CycleBar product={product} placed={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReleaseBand({ product, placed }: { product: SupportProduct; placed: readonly PlacedCycle[] }) {
  const lanes = Math.min(placed.length, RELEASE_LANES);
  return (
    <ul
      className="sw-timeline__cycles sw-timeline__band"
      aria-label={`${product.label} release cycles`}
      style={{ "--lanes": lanes } as CSSProperties}
    >
      {placed.map((item, index) => (
        <li
          key={item.cycle.cycle}
          className="sw-timeline__track sw-timeline__band-item"
          aria-label={cycleLabel(product, item.cycle)}
          style={{ "--lane": releaseLane(index) } as CSSProperties}
        >
          <span aria-hidden="true">
            <CycleBar product={product} placed={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProductRows({ product, index, range }: { product: SupportProduct; index: number; range: TimeRange }) {
  const placed = placedCycles(product, range);
  const Rows = isReleaseBand(product) ? ReleaseBand : CycleRows;
  return (
    <div className="sw-timeline__product" style={{ "--hue": productHue(index) } as CSSProperties}>
      <div className="sw-timeline__head">
        <h3 className="sw-timeline__label">{product.label}</h3>
        <StatusChip product={product} />
      </div>
      <Rows product={product} placed={placed} />
    </div>
  );
}

export function Timeline({ products, range, today }: TimelineProps) {
  const now = todayOffset(today, range);
  return (
    <div className="sw-timeline" role="region" aria-label="Release calendar" tabIndex={0}>
      <div className="sw-timeline__canvas">
        <Grid range={range} now={now} />
        <YearAxis range={range} now={now} />
        {products.map((product, index) => (
          <ProductRows key={product.product} product={product} index={index} range={range} />
        ))}
      </div>
    </div>
  );
}

export function TimelineLegend() {
  return (
    <ul className="sw-legend" aria-label="Calendar legend">
      <li>
        <span className="sw-legend__swatch sw-bar--current" aria-hidden="true" /> Version in use
      </li>
      <li>
        <span className="sw-legend__swatch sw-bar--open" aria-hidden="true" /> No end date published
      </li>
      <li>
        <span className="sw-legend__swatch sw-bar--clipped-end" aria-hidden="true" /> Continues past the chart
      </li>
      <li>
        <span className="sw-legend__today" aria-hidden="true" /> Today
      </li>
    </ul>
  );
}

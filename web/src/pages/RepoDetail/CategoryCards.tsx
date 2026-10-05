import { useMemo } from "react";
import { PlotFigure } from "../../components/PlotFigure";
import { toFixedHalfEven } from "../../format";
import {
  categorySparkline,
  categoryTrend,
  datedRates,
  ratePoints,
  trendText,
  type CategoryTrend,
  type TrendDirection,
} from "./categorySparkline";
import type { RepoDetail } from "./repoDetailData";
import { StatusChip } from "./StatusChip";

type CategoryCard = RepoDetail["category_cards"][number];
type Rates = readonly (number | null)[];

export interface RepoRates {
  dates: readonly string[];
  byCategory: Record<string, Rates>;
}

const ARROWS: Record<TrendDirection, string> = { up: "▲", down: "▼", flat: "" };
const SPOKEN: Record<TrendDirection, string> = { up: "Up ", down: "Down ", flat: "" };

export function passRateChip(card: CategoryCard): { status: string; label: string } {
  if (card.pass_rate === null) return { status: "unknown", label: "no data" };
  return { status: card.level, label: `${toFixedHalfEven(card.pass_rate, 0)}% pass` };
}

export function meterWidth(passRate: number | null): number {
  return passRate === null ? 0 : Math.max(0, Math.min(100, passRate));
}

function PassMeter({ card }: { card: CategoryCard }) {
  return (
    <div className="category-meter" aria-hidden="true">
      <span
        className={`category-meter__fill category-meter__fill--${card.level}`}
        style={{ width: `${meterWidth(card.pass_rate)}%` }}
      />
    </div>
  );
}

function TrendNote({ trend }: { trend: CategoryTrend }) {
  const arrow = ARROWS[trend.direction];
  return (
    <p className={`category-trend category-trend--${trend.direction}`}>
      {arrow && <span aria-hidden="true">{arrow} </span>}
      <span className="visually-hidden">{SPOKEN[trend.direction]}</span>
      {trendText(trend)}
    </p>
  );
}

function History({ category, dates, rates }: { category: string; dates: readonly string[]; rates?: Rates }) {
  const trend = useMemo(() => categoryTrend(datedRates(dates, rates)), [dates, rates]);
  const chart = useMemo(() => categorySparkline(category, ratePoints(dates, rates)), [category, dates, rates]);
  return (
    <>
      {trend && <TrendNote trend={trend} />}
      {chart && <PlotFigure spec={chart.spec} ariaLabel={chart.ariaLabel} />}
    </>
  );
}

function Card({ card, rates }: { card: CategoryCard; rates: RepoRates | null }) {
  const chip = passRateChip(card);
  return (
    <div className="category-card" role="group" aria-label={card.name}>
      <div className="category-card__head">
        <strong>{card.name}</strong>
        <StatusChip status={chip.status} label={chip.label} />
      </div>
      <PassMeter card={card} />
      <p className="caption">{`Pass ${card.pass} · Fail ${card.fail} · N/A ${card.na}`}</p>
      {rates && <History category={card.name} dates={rates.dates} rates={rates.byCategory[card.name]} />}
    </div>
  );
}

export function CategoryCards({ cards, rates }: { cards: readonly CategoryCard[]; rates: RepoRates | null }) {
  return (
    <section className="repo-detail-section" aria-labelledby="category-heading">
      <h2 id="category-heading">Category overview</h2>
      <div className="category-grid">
        {cards.map((card) => (
          <Card key={card.name} card={card} rates={rates} />
        ))}
      </div>
    </section>
  );
}

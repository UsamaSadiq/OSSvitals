import { useMemo } from "react";
import { PlotFigure } from "../../components/PlotFigure";
import { toFixedHalfEven } from "../../format";
import { categorySparkline, ratePoints } from "./categorySparkline";
import type { RepoDetail } from "./repoDetailData";
import { StatusChip } from "./StatusChip";

type CategoryCard = RepoDetail["category_cards"][number];
type Rates = readonly (number | null)[];

export interface RepoRates {
  dates: readonly string[];
  byCategory: Record<string, Rates>;
}

export function passRateChip(card: CategoryCard): { status: string; label: string } {
  if (card.pass_rate === null) return { status: "unknown", label: "no data" };
  return { status: card.level, label: `${toFixedHalfEven(card.pass_rate, 0)}% pass` };
}

function Sparkline({ category, dates, rates }: { category: string; dates: readonly string[]; rates?: Rates }) {
  const chart = useMemo(() => categorySparkline(category, ratePoints(dates, rates)), [category, dates, rates]);
  return chart ? <PlotFigure spec={chart.spec} ariaLabel={chart.ariaLabel} /> : null;
}

function Card({ card, rates }: { card: CategoryCard; rates: RepoRates | null }) {
  const chip = passRateChip(card);
  return (
    <div className="category-card" role="group" aria-label={card.name}>
      <div className="category-card__head">
        <strong>{card.name}</strong>
        <StatusChip status={chip.status} label={chip.label} />
      </div>
      <p className="caption">{`Pass ${card.pass} · Fail ${card.fail} · N/A ${card.na}`}</p>
      {rates && <Sparkline category={card.name} dates={rates.dates} rates={rates.byCategory[card.name]} />}
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

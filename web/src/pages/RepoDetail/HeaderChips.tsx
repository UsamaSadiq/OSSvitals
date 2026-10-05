import { Link } from "react-router";
import type { HeaderChip } from "./repoFacts";

function ChipValue({ chip }: { chip: HeaderChip }) {
  if (chip.to === undefined) return <span className="header-chip__value">{chip.value}</span>;
  return (
    <Link className="header-chip__value" to={chip.to}>
      {chip.value}
    </Link>
  );
}

export function HeaderChips({ chips }: { chips: readonly HeaderChip[] }) {
  if (chips.length === 0) return null;
  return (
    <ul className="header-chips" aria-label="Repository facts">
      {chips.map((chip) => (
        <li key={chip.id} className="header-chip">
          <span className="header-chip__label">{chip.label}</span> <ChipValue chip={chip} />
        </li>
      ))}
    </ul>
  );
}

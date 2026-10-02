const EXACT_DIGITS = 60;

interface Expansion {
  sign: string;
  whole: string;
  kept: string;
  rest: string;
}

function expand(value: number, decimals: number): Expansion {
  const exact = Math.abs(value).toFixed(Math.min(100, decimals + EXACT_DIGITS));
  const [whole = "0", fraction = ""] = exact.split(".");
  return {
    sign: value < 0 ? "-" : "",
    whole,
    kept: fraction.slice(0, decimals),
    rest: fraction.slice(decimals),
  };
}

function isExactTie({ rest }: Expansion): boolean {
  return /^50*$/.test(rest);
}

function lastKeptDigit({ whole, kept }: Expansion): number {
  return Number((kept || whole).at(-1));
}

function truncated({ sign, whole, kept }: Expansion): string {
  return kept ? `${sign}${whole}.${kept}` : `${sign}${whole}`;
}

// Python's format() rounds exact binary ties to even; Number.toFixed rounds them away from zero.
export function toFixedHalfEven(value: number, decimals = 0): string {
  const expansion = expand(value, decimals);
  const roundsDownToEven = isExactTie(expansion) && lastKeptDigit(expansion) % 2 === 0;
  return roundsDownToEven ? truncated(expansion) : value.toFixed(decimals);
}

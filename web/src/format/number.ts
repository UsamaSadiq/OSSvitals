const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatNumber(value: number, decimals = 0): string {
  if (decimals === 0) return integerFormat.format(value);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatScore(value: number): string {
  return value.toFixed(1);
}

/** "1 change", "4 changes"; pass ``plural`` for nouns that do not take an s. */
export function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`;
}

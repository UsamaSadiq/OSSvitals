export function truncate(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

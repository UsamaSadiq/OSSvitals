function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatUtcDate(value: string | Date): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

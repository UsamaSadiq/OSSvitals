function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatUtcDate(value: string | Date): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function utcMinute(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function refreshedNote(collectedAt: string | null | undefined, refreshedAt: string | null | undefined): string {
  if (!refreshedAt) return "";
  const refreshed = toDate(refreshedAt);
  if (Number.isNaN(refreshed.getTime())) return "";
  if (collectedAt && refreshed <= toDate(collectedAt)) return "";
  return ` Changed repos refreshed ${utcMinute(refreshed)}.`;
}

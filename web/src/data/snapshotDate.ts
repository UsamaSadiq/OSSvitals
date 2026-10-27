const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function snapshotDateOf(timestamp: string | null | undefined): string | null {
  const day = (timestamp ?? "").trim().slice(0, 10);
  if (!ISO_DATE.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return null;
  return day;
}

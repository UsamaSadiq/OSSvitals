const HOURS_PER_DAY = 24;
const DAYS_THRESHOLD_HOURS = 48;

export function formatAge(ageHours: number): string {
  if (ageHours < DAYS_THRESHOLD_HOURS) return `${ageHours}h`;
  return `${Math.floor(ageHours / HOURS_PER_DAY)} days`;
}

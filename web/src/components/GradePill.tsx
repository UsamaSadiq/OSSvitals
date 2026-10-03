export const GRADE_ORDER = ["A", "B", "C", "D", "F"] as const;

export type Grade = (typeof GRADE_ORDER)[number];

export function isGrade(value: string): value is Grade {
  return (GRADE_ORDER as readonly string[]).includes(value);
}

export function GradePill({ grade }: { grade: string }) {
  const modifier = isGrade(grade) ? grade.toLowerCase() : "unknown";
  return (
    <span className={`grade-pill grade-pill--${modifier}`} role="img" aria-label={`Grade ${grade}`}>
      {grade}
    </span>
  );
}

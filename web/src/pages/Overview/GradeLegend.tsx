import { GRADE_ORDER } from "../../components/GradePill";

export function GradeLegend() {
  return (
    <ul className="grade-legend" aria-label="Grade colours">
      {GRADE_ORDER.map((grade) => (
        <li key={grade} className="grade-legend__item">
          <span className={`grade-legend__swatch grade-legend__swatch--${grade.toLowerCase()}`} aria-hidden="true" />
          Grade {grade}
        </li>
      ))}
    </ul>
  );
}

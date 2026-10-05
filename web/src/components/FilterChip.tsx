import type { ReactNode } from "react";
import "./controls.css";

interface FilterChipProps {
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
  label?: string;
}

export function FilterChip({ pressed, onToggle, children, label }: FilterChipProps) {
  return (
    <button type="button" className="filter-chip" aria-pressed={pressed} aria-label={label} onClick={onToggle}>
      {children}
    </button>
  );
}

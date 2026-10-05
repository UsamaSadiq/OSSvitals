export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <span className="skeleton skeleton--title" aria-hidden="true" />
      <span className="skeleton skeleton--line" aria-hidden="true" />
      <span className="skeleton skeleton--short" aria-hidden="true" />
      <span className="skeleton skeleton--block" aria-hidden="true" />
    </div>
  );
}

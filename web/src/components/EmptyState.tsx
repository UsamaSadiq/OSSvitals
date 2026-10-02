import type { ReactNode } from "react";

export type EmptyStateKind = "good" | "info" | "warn" | "error";

interface EmptyStateProps {
  kind?: EmptyStateKind;
  title: string;
  body?: ReactNode;
  action?: { label: string; href: string };
}

export function EmptyState({ kind = "info", title, body, action }: EmptyStateProps) {
  return (
    <div className={`banner banner--${kind}`} role={kind === "error" ? "alert" : "status"}>
      {body ? <strong>{title}</strong> : title}
      {body && <p>{body}</p>}
      {action && (
        <p>
          <a className="button-link" href={action.href}>
            {action.label}
          </a>
        </p>
      )}
    </div>
  );
}

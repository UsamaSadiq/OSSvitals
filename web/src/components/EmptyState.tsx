import type { ReactNode } from "react";
import { CheckIcon, InfoIcon } from "./icons";

export type EmptyStateKind = "good" | "info" | "warn" | "error";

interface EmptyStateProps {
  kind?: EmptyStateKind;
  title: string;
  body?: ReactNode;
  action?: { label: string; href: string };
}

type Action = EmptyStateProps["action"];

function Content({ title, body, action, actionClass }: Omit<EmptyStateProps, "kind"> & { actionClass?: string }) {
  return (
    <>
      {body ? <strong>{title}</strong> : title}
      {body && <p>{body}</p>}
      {action && (
        <p>
          <a className={actionClass} href={action.href}>
            {action.label}
          </a>
        </p>
      )}
    </>
  );
}

function QuietNote({ kind, title, body, action }: { kind: "good" | "info"; title: string; body?: ReactNode; action?: Action }) {
  const Icon = kind === "good" ? CheckIcon : InfoIcon;
  return (
    <div className={`empty-state empty-state--${kind} note note--${kind}`} role="status">
      <Icon className="note__icon" />
      <div className="note__body">
        <Content title={title} body={body} action={action} />
      </div>
    </div>
  );
}

export function EmptyState({ kind = "info", title, body, action }: EmptyStateProps) {
  if (kind === "info" || kind === "good") return <QuietNote kind={kind} title={title} body={body} action={action} />;
  return (
    <div className={`empty-state empty-state--${kind} banner banner--${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Content title={title} body={body} action={action} actionClass="button-link" />
    </div>
  );
}
